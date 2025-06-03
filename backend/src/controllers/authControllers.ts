import { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { AuthRequest } from '../types';

export const login = async (req: Request, res: Response) => {
      try {
            console.log('🚀 === LOGIN REQUEST START ===');
            console.log('📋 Request body:', req.body);

            const { username, password } = req.body;

            console.log('🔐 Login attempt:', {
                  username,
                  passwordLength: password?.length,
                  passwordProvided: !!password
            });

            if (!username || !password) {
                  console.log('❌ Missing credentials');
                  return res.status(400).json({
                        success: false,
                        message: 'Username dan password harus diisi'
                  });
            }

            // Find user
            console.log('🔍 Searching for user in database...');
            const userResult = await query(
                  'SELECT id, username, email, password FROM users WHERE username = $1',
                  [username]
            );

            console.log('👤 Database query result:', {
                  rowCount: userResult.rows.length,
                  userFound: userResult.rows.length > 0
            });

            if (userResult.rows.length === 0) {
                  console.log('❌ User not found in database');
                  return res.status(401).json({
                        success: false,
                        message: 'Username atau password salah'
                  });
            }

            const user = userResult.rows[0];
            console.log('👤 User data retrieved:', {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  hasPassword: !!user.password,
                  passwordLength: user.password?.length
            });

            // Verify password
            console.log('🔑 Starting password verification...');
            console.log('🔑 Input password:', password);
            console.log('🔑 Stored hash length:', user.password?.length);

            const isValidPassword = await bcrypt.compare(password, user.password);
            console.log('🔑 Password verification result:', isValidPassword);

            if (!isValidPassword) {
                  console.log('❌ Password verification failed');
                  return res.status(401).json({
                        success: false,
                        message: 'Username atau password salah'
                  });
            }

            // Generate JWT token
            console.log('🎫 Generating JWT token...');
            console.log('🔐 JWT Secret exists:', !!process.env.JWT_SECRET);

            const token = jwt.sign(
                  {
                        id: user.id,
                        username: user.username,
                        email: user.email
                  },
                  process.env.JWT_SECRET || 'your-secret-key',
                  { expiresIn: '24h' }
            );

            console.log('✅ JWT token generated successfully');
            console.log('🚀 === LOGIN SUCCESS ===');

            res.json({
                  success: true,
                  message: 'Login berhasil',
                  data: {
                        token,
                        user: {
                              id: user.id,
                              username: user.username,
                              email: user.email
                        }
                  }
            });

      } catch (error) {
            console.error('💥 LOGIN ERROR:', error);
            console.error('💥 Error stack:', error.stack);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};

export const verifyToken = async (req: AuthRequest, res: Response) => {
      try {
            res.json({
                  success: true,
                  message: 'Token valid',
                  data: {
                        user: req.user
                  }
            });
      } catch (error) {
            console.error('Verify token error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
      try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user?.id;

            if (!currentPassword || !newPassword) {
                  return res.status(400).json({
                        success: false,
                        message: 'Password lama dan password baru harus diisi'
                  });
            }

            if (newPassword.length < 6) {
                  return res.status(400).json({
                        success: false,
                        message: 'Password baru minimal 6 karakter'
                  });
            }

            // Get current user
            const userResult = await query(
                  'SELECT password FROM users WHERE id = $1',
                  [userId]
            );

            if (userResult.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'User tidak ditemukan'
                  });
            }

            const user = userResult.rows[0];

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, user.password);
            if (!isValidPassword) {
                  return res.status(401).json({
                        success: false,
                        message: 'Password lama tidak sesuai'
                  });
            }

            // Hash new password
            const hashedNewPassword = await bcrypt.hash(newPassword, 12);

            // Update password
            await query(
                  'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                  [hashedNewPassword, userId]
            );

            res.json({
                  success: true,
                  message: 'Password berhasil diubah'
            });

      } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};