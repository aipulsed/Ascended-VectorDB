/**
 * Tenant service for @ascendstack/vectordb.
 * Handles tenant creation, validation, and API key generation for authentication.
 */

import { Tenant, ApiKey } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: string;
  metadata?: Record<string, unknown>;
}

export interface GenerateApiKeyInput {
  tenantId: string;
  name: string;
  scopes?: string[];
  expiresAt?: Date;
}

export interface GenerateApiKeyResult {
  apiKey: ApiKey;
  /** The raw key — shown once at creation, never stored. */
  rawKey: string;
}

/** Service for tenant provisioning and API key management. */
export class TenantService {
  /**
   * Creates a new tenant in the system.
   */
  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    try {
      const existing = await prisma.tenant.findUnique({ where: { slug: input.slug } });
      if (existing) throw new Error(`Tenant with slug "${input.slug}" already exists`);

      const tenant = await prisma.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          plan: input.plan ?? 'free',
          metadata: input.metadata as object | undefined,
        },
      });

      logger.info('Tenant created', { tenantId: tenant.id, slug: tenant.slug });
      return tenant;
    } catch (error) {
      logger.error('Failed to create tenant', { slug: input.slug, error });
      throw error;
    }
  }

  /**
   * Returns a tenant by ID.
   */
  async getTenant(tenantId: string): Promise<Tenant> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    return tenant;
  }

  /**
   * Validates that a tenant exists and is active.
   */
  async validateTenant(tenantId: string): Promise<boolean> {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      return !!tenant && tenant.isActive;
    } catch {
      return false;
    }
  }

  /**
   * Generates a new API key for the given tenant.
   * The raw key is returned once and never stored — only its SHA-256 hash is persisted.
   */
  async generateApiKey(input: GenerateApiKeyInput): Promise<GenerateApiKeyResult> {
    try {
      const rawKey = `avdb_${randomBytes(32).toString('hex')}`;
      const keyHash = createHash('sha256').update(rawKey).digest('hex');

      const apiKey = await prisma.apiKey.create({
        data: {
          tenant_id: input.tenantId,
          name: input.name,
          key_hash: keyHash,
          scopes: input.scopes ?? [],
          expires_at: input.expiresAt,
        },
      });

      logger.info('API key generated', { tenantId: input.tenantId, keyId: apiKey.id });
      return { apiKey, rawKey };
    } catch (error) {
      logger.error('Failed to generate API key', { tenantId: input.tenantId, error });
      throw error;
    }
  }
}

export const tenantService = new TenantService();
