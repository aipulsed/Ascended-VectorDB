/**
 * Unit tests for ExecutionService.
 * Verifies execution creation, status transitions, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionService } from '../../../src/services/execution.service';

vi.mock('../../../src/repositories/execution.repository', () => ({
  executionRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    getWithTasks: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/task.repository', () => ({
  taskRepository: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/event.repository', () => ({
  eventRepository: {
    create: vi.fn(),
    getTimeline: vi.fn(),
  },
}));

vi.mock('../../../src/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { executionRepository } from '../../../src/repositories/execution.repository';
import { eventRepository } from '../../../src/repositories/event.repository';

const mockExecRepo = executionRepository as unknown as {
  create: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  getWithTasks: ReturnType<typeof vi.fn>;
};

const mockEventRepo = eventRepository as unknown as {
  create: ReturnType<typeof vi.fn>;
  getTimeline: ReturnType<typeof vi.fn>;
};

const TENANT = 'tenant-abc';

describe('ExecutionService', () => {
  let service: ExecutionService;

  beforeEach(() => {
    service = new ExecutionService();
    vi.clearAllMocks();
  });

  describe('createExecution', () => {
    it('creates an execution and emits a created event', async () => {
      const mockExecution = {
        id: 'exec-1',
        tenant_id: TENANT,
        status: 'PENDING',
        workflow_id: null,
        input: null,
        output: null,
        error: null,
        started_at: null,
        completed_at: null,
        retries: 0,
        max_retries: 3,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockExecRepo.create.mockResolvedValueOnce(mockExecution);
      mockEventRepo.create.mockResolvedValueOnce({ id: 'evt-1' });

      const result = await service.createExecution(TENANT, { workflowId: undefined });

      expect(mockExecRepo.create).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ status: 'PENDING' }),
      );
      expect(mockEventRepo.create).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ type: 'execution.created' }),
      );
      expect(result).toEqual(mockExecution);
    });
  });

  describe('updateStatus', () => {
    it('sets started_at when transitioning to RUNNING', async () => {
      const mockExecution = { id: 'exec-1', status: 'RUNNING', tenant_id: TENANT };
      mockExecRepo.update.mockResolvedValueOnce(mockExecution);
      mockEventRepo.create.mockResolvedValueOnce({ id: 'evt-2' });

      const result = await service.updateStatus(TENANT, 'exec-1', 'RUNNING');

      expect(mockExecRepo.update).toHaveBeenCalledWith(
        TENANT,
        'exec-1',
        expect.objectContaining({ status: 'RUNNING', started_at: expect.any(Date) }),
      );
      expect(result.status).toBe('RUNNING');
    });

    it('sets completed_at when transitioning to COMPLETED', async () => {
      const mockExecution = { id: 'exec-1', status: 'COMPLETED', tenant_id: TENANT };
      mockExecRepo.update.mockResolvedValueOnce(mockExecution);
      mockEventRepo.create.mockResolvedValueOnce({ id: 'evt-3' });

      await service.updateStatus(TENANT, 'exec-1', 'COMPLETED');

      expect(mockExecRepo.update).toHaveBeenCalledWith(
        TENANT,
        'exec-1',
        expect.objectContaining({ status: 'COMPLETED', completed_at: expect.any(Date) }),
      );
    });
  });

  describe('markFailed', () => {
    it('increments retries and records error message', async () => {
      const existingExecution = { id: 'exec-1', retries: 1, tenant_id: TENANT };
      const failedExecution = { id: 'exec-1', status: 'FAILED', retries: 2 };

      mockExecRepo.findById.mockResolvedValueOnce(existingExecution);
      mockExecRepo.update.mockResolvedValueOnce(failedExecution);

      const result = await service.markFailed(TENANT, 'exec-1', 'Something went wrong');

      expect(mockExecRepo.update).toHaveBeenCalledWith(
        TENANT,
        'exec-1',
        expect.objectContaining({
          status: 'FAILED',
          error: 'Something went wrong',
          retries: 2,
        }),
      );
      expect(result.status).toBe('FAILED');
    });

    it('throws when execution is not found', async () => {
      mockExecRepo.findById.mockResolvedValueOnce(null);

      await expect(service.markFailed(TENANT, 'nonexistent', 'error')).rejects.toThrow(
        'Execution nonexistent not found',
      );
    });
  });
});
