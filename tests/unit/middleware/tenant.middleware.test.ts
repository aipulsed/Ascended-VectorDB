/**
 * Unit tests for tenantMiddleware.
 * Verifies header extraction, missing header rejection, and inactive tenant handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../../src/services/tenant.service', () => ({
  tenantService: {
    validateTenant: vi.fn(),
  },
}));

vi.mock('../../../src/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { tenantMiddleware } from '../../../src/middleware/tenant.middleware';
import { tenantService } from '../../../src/services/tenant.service';

const mockTenantService = tenantService as unknown as {
  validateTenant: ReturnType<typeof vi.fn>;
};

function mockRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockResponse(): { res: Response; status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

describe('tenantMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('rejects requests missing X-Tenant-Id header with 400', async () => {
    const req = mockRequest({});
    const { res, status, json } = mockResponse();

    await tenantMiddleware(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'X-Tenant-Id header required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects unknown or inactive tenants with 403', async () => {
    mockTenantService.validateTenant.mockResolvedValueOnce(false);

    const req = mockRequest({ 'x-tenant-id': 'bad-tenant' });
    const { res, status, json } = mockResponse();

    await tenantMiddleware(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: 'Tenant not found or inactive' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches tenantId to request and calls next for valid tenants', async () => {
    mockTenantService.validateTenant.mockResolvedValueOnce(true);

    const req = mockRequest({ 'x-tenant-id': 'tenant-123' }) as Request & { tenantId?: string };
    const { res } = mockResponse();

    await tenantMiddleware(req, res, next);

    expect(req.tenantId).toBe('tenant-123');
    expect(next).toHaveBeenCalled();
  });

  it('returns 500 on unexpected errors', async () => {
    mockTenantService.validateTenant.mockRejectedValueOnce(new Error('DB down'));

    const req = mockRequest({ 'x-tenant-id': 'tenant-123' });
    const { res, status } = mockResponse();

    await tenantMiddleware(req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
