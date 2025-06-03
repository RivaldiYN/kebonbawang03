// backend/src/middleware/auth.ts
import { Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthRequest, JWTPayload } from '../types';

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
            return res.status(401).json({
                  success: false,
                  message: 'Token akses diperlukan'
            });
      }

      try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as JWTPayload;
            req.user = decoded;
            next();
      } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                  return res.status(401).json({
                        success: false,
                        message: 'Token sudah kadaluarsa'
                  });
            } else if (error instanceof jwt.JsonWebTokenError) {
                  return res.status(403).json({
                        success: false,
                        message: 'Token tidak valid'
                  });
            } else {
                  return res.status(500).json({
                        success: false,
                        message: 'Terjadi kesalahan dalam verifikasi token'
                  });
            }
      }
};

// Tambahkan default export ini
export default authenticateToken;