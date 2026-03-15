import { NextResponse } from 'next/server';
import { safeErrorBody } from '@/lib/api-errors';
import { authenticateAgent } from '@/lib/a2a';
import {
  installPackageSchema,
  uninstallPackageSchema,
  installPackage,
  uninstallPackage,
} from '@/lib/a2a/marketplace';

/**
 * POST /api/a2a/marketplace/packages/:id/install — Install a package.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const input = installPackageSchema.parse(body);

    const result = await installPackage({
      package_id: id,
      agent_id: agent.id,
      version: input.version,
      auto_update: input.auto_update,
      resolve_dependencies: input.resolve_dependencies,
    });

    return NextResponse.json(
      {
        installation_id: result.installation.id,
        package_id: result.installation.package_id,
        package_name: result.installation.package_name,
        installed_version: result.installation.installed_version,
        dependencies_installed: result.dependencies_installed,
        created_at: result.installation.created_at,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[marketplace/install]', err);
    const status = err instanceof Error && err.message.includes('already installed') ? 409 : 400;
    return NextResponse.json(safeErrorBody(err), { status });
  }
}

/**
 * DELETE /api/a2a/marketplace/packages/:id/install — Uninstall a package.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await uninstallPackage(id, agent.id);
    return NextResponse.json({ success: true, package_id: id });
  } catch (err) {
    console.error('[marketplace/uninstall]', err);
    return NextResponse.json(safeErrorBody(err), { status: 400 });
  }
}
