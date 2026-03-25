/**
 * Execution service for @ascendstack/vectordb.
 * Orchestrates workflow execution lifecycle: creation, status transitions,
 * task appending, completion, failure, and replay from a specific step.
 */

import { Execution, ExecutionStatus, Task, TaskStatus } from '@prisma/client';
import { executionRepository } from '../repositories/execution.repository';
import { taskRepository } from '../repositories/task.repository';
import { eventRepository } from '../repositories/event.repository';
import { logger } from '../lib/logger';
import { Event } from '@prisma/client';

export interface CreateExecutionInput {
  workflowId?: string;
  input?: Record<string, unknown>;
  maxRetries?: number;
}

export interface AppendTaskInput {
  stepName: string;
  type: string;
  input?: Record<string, unknown>;
}

export interface ExecutionTimeline {
  execution: Execution;
  tasks: Task[];
  events: Event[];
}

/** Service managing execution lifecycle state transitions. */
export class ExecutionService {
  /**
   * Creates a new execution in PENDING state.
   */
  async createExecution(tenantId: string, input: CreateExecutionInput): Promise<Execution> {
    try {
      const execution = await executionRepository.create(tenantId, {
        workflow_id: input.workflowId,
        input: input.input as object | undefined,
        max_retries: input.maxRetries ?? 3,
        status: 'PENDING',
      });

      logger.info('Execution created', { tenantId, executionId: execution.id });

      await eventRepository.create(tenantId, {
        type: 'execution.created',
        payload: { executionId: execution.id, workflowId: input.workflowId },
        execution_id: execution.id,
        source: '@ascendstack/vectordb',
      });

      return execution;
    } catch (error) {
      logger.error('Failed to create execution', { tenantId, error });
      throw error;
    }
  }

  /**
   * Transitions an execution to a new status.
   * Automatically sets started_at on RUNNING and completed_at on terminal states.
   */
  async updateStatus(
    tenantId: string,
    executionId: string,
    status: ExecutionStatus,
  ): Promise<Execution> {
    try {
      const now = new Date();
      const updateData: Record<string, unknown> = { status };

      if (status === 'RUNNING') updateData['started_at'] = now;
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
        updateData['completed_at'] = now;
      }

      const execution = await executionRepository.update(tenantId, executionId, updateData);

      await eventRepository.create(tenantId, {
        type: `execution.${status.toLowerCase()}`,
        payload: { executionId, status },
        execution_id: executionId,
        source: '@ascendstack/vectordb',
      });

      return execution;
    } catch (error) {
      logger.error('Failed to update execution status', { tenantId, executionId, status, error });
      throw error;
    }
  }

  /**
   * Appends a new task to an execution, setting it to PENDING.
   */
  async appendTask(tenantId: string, executionId: string, input: AppendTaskInput): Promise<Task> {
    try {
      return await taskRepository.create(tenantId, {
        execution_id: executionId,
        step_name: input.stepName,
        type: input.type,
        input: input.input as object | undefined,
        status: 'PENDING',
      });
    } catch (error) {
      logger.error('Failed to append task', { tenantId, executionId, error });
      throw error;
    }
  }

  /**
   * Marks an execution as COMPLETED with the given output.
   */
  async markComplete(
    tenantId: string,
    executionId: string,
    output?: Record<string, unknown>,
  ): Promise<Execution> {
    return this.updateStatus(tenantId, executionId, 'COMPLETED').then(async (exec) => {
      if (output) {
        return executionRepository.update(tenantId, executionId, {
          output: output as object,
        });
      }
      return exec;
    });
  }

  /**
   * Marks an execution as FAILED with the given error message, incrementing retries.
   */
  async markFailed(
    tenantId: string,
    executionId: string,
    errorMessage: string,
  ): Promise<Execution> {
    try {
      const existing = await executionRepository.findById(tenantId, executionId);
      if (!existing) throw new Error(`Execution ${executionId} not found`);

      const execution = await executionRepository.update(tenantId, executionId, {
        status: 'FAILED',
        error: errorMessage,
        completed_at: new Date(),
        retries: existing.retries + 1,
      });

      logger.warn('Execution failed', { tenantId, executionId, error: errorMessage });
      return execution;
    } catch (error) {
      logger.error('Failed to mark execution as failed', { tenantId, executionId, error });
      throw error;
    }
  }

  /**
   * Replays an execution from a specific step by resetting tasks from that step onward
   * to PENDING status and transitioning the execution back to RUNNING.
   */
  async replayFromStep(tenantId: string, executionId: string, fromStep: string): Promise<Execution> {
    try {
      const executionWithTasks = await executionRepository.getWithTasks(tenantId, executionId);
      if (!executionWithTasks) throw new Error(`Execution ${executionId} not found`);

      const stepIndex = executionWithTasks.tasks.findIndex((t) => t.step_name === fromStep);
      if (stepIndex === -1) throw new Error(`Step ${fromStep} not found in execution`);

      const tasksToReset = executionWithTasks.tasks.slice(stepIndex);
      await Promise.all(
        tasksToReset.map((task) =>
          taskRepository.update(tenantId, task.id, {
            status: 'PENDING' as TaskStatus,
            output: undefined,
            error: null,
            started_at: null,
            completed_at: null,
          }),
        ),
      );

      const execution = await this.updateStatus(tenantId, executionId, 'RUNNING');
      logger.info('Execution replay initiated', { tenantId, executionId, fromStep });
      return execution;
    } catch (error) {
      logger.error('Failed to replay execution', { tenantId, executionId, fromStep, error });
      throw error;
    }
  }

  /**
   * Returns the complete execution timeline including tasks and events, ordered chronologically.
   */
  async getExecutionTimeline(tenantId: string, executionId: string): Promise<ExecutionTimeline> {
    try {
      const [executionWithTasks, events] = await Promise.all([
        executionRepository.getWithTasks(tenantId, executionId),
        eventRepository.getTimeline(tenantId, executionId),
      ]);

      if (!executionWithTasks) throw new Error(`Execution ${executionId} not found`);

      return {
        execution: executionWithTasks,
        tasks: executionWithTasks.tasks,
        events,
      };
    } catch (error) {
      logger.error('Failed to get execution timeline', { tenantId, executionId, error });
      throw error;
    }
  }
}

export const executionService = new ExecutionService();
