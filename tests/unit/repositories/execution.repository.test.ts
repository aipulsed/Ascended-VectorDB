/**
 * Unit tests for ExecutionRepository.
 * Mocks Prisma to verify tenant-scoped CRUD and status filtering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionRepository } from '../../../src/repositories/execution.repository';

// Mock the prisma module
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    execution: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock logger to suppress output
vi.mock('../../../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    http: vi.fn(),
    debug: vi.fn(),
  },
}));

import { prisma } from '../../../src/lib/prisma';

const mockPrisma = prisma as unknown as {
  execution: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const TENANT = 'tenant-123';

describe('ExecutionRepository', () => {
  let repo: ExecutionRepository;

  beforeEach(() => {
    repo = new ExecutionRepository();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates an execution with tenant_id', async () => {
      const mockExecution = {
        id: 'exec-1',
        tenant_id: TENANT,
        status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
        workflow_id: null,
        input: null,
        output: null,
        error: null,
        started_at: null,
        completed_at: null,
        retries: 0,
        max_retries: 3,
      };

      mockPrisma.execution.create.mockResolvedValueOnce(mockExecution);

      const result = await repo.create(TENANT, { status: 'PENDING', max_retries: 3 });

      expect(mockPrisma.execution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tenant_id: TENANT, status: 'PENDING' }),
      });
      expect(result).toEqual(mockExecution);
    });
  });

  describe('findById', () => {
    it('finds execution scoped to tenant', async () => {
      const mockExecution = { id: 'exec-1', tenant_id: TENANT };
      mockPrisma.execution.findFirst.mockResolvedValueOnce(mockExecution);

      const result = await repo.findById(TENANT, 'exec-1');

      expect(mockPrisma.execution.findFirst).toHaveBeenCalledWith({
        where: { id: 'exec-1', tenant_id: TENANT },
      });
      expect(result).toEqual(mockExecution);
    });

    it('returns null when not found', async () => {
      mockPrisma.execution.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById(TENANT, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns paginated executions for tenant', async () => {
      const mockExecutions = [{ id: 'exec-1', tenant_id: TENANT }];
      mockPrisma.$transaction.mockResolvedValueOnce([mockExecutions, 1]);

      const result = await repo.list(TENANT, { page: 1, limit: 10 });

      expect(result.data).toEqual(mockExecutions);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('findByStatus', () => {
    it('filters executions by status', async () => {
      const mockExecutions = [{ id: 'exec-1', status: 'RUNNING', tenant_id: TENANT }];
      mockPrisma.execution.findMany.mockResolvedValueOnce(mockExecutions);

      const result = await repo.findByStatus(TENANT, 'RUNNING');

      expect(mockPrisma.execution.findMany).toHaveBeenCalledWith({
        where: { tenant_id: TENANT, status: 'RUNNING' },
        orderBy: { created_at: 'desc' },
      });
      expect(result).toEqual(mockExecutions);
    });
  });

  describe('delete', () => {
    it('deletes execution scoped to tenant', async () => {
      mockPrisma.execution.deleteMany.mockResolvedValueOnce({ count: 1 });

      await repo.delete(TENANT, 'exec-1');

      expect(mockPrisma.execution.deleteMany).toHaveBeenCalledWith({
        where: { id: 'exec-1', tenant_id: TENANT },
      });
    });
  });
});
