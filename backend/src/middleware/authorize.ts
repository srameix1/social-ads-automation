import { Request, Response, NextFunction } from 'express';

export function authorize(...roles: ('client' | 'admin')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acceso denegado: permisos insuficientes' });
      return;
    }
    next();
  };
}
