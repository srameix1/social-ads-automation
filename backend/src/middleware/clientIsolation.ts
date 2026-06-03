import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../config/database';

/**
 * Verifica que el recurso solicitado pertenezca al cliente autenticado.
 * Usa req.params.clientId o el userId del JWT.
 */
export function requireOwnership(resourceTable: string, resourceParam = 'id') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user.role === 'admin') {
      next();
      return;
    }

    const resourceId = req.params[resourceParam];
    if (!resourceId) {
      next();
      return;
    }

    try {
      const row = await queryOne<{ client_id: string }>(
        `SELECT client_id FROM ${resourceTable} WHERE id = $1`,
        [resourceId],
      );

      if (!row) {
        res.status(404).json({ error: 'Recurso no encontrado' });
        return;
      }

      if (row.client_id !== req.user.userId) {
        res.status(403).json({ error: 'Acceso denegado: recurso no pertenece a este cliente' });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
