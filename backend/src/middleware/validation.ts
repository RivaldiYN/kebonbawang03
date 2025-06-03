import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { FileUploadRequest } from '../types';

export const validateNews = [
      body('judul')
            .trim()
            .isLength({ min: 5, max: 255 })
            .withMessage('Title must be between 5 and 255 characters')
            .matches(/^[^<>'"]*$/)
            .withMessage('Title contains invalid characters'),
      
      body('isi_content')
            .trim()
            .isLength({ min: 10 })
            .withMessage('Content must be at least 10 characters long'),
      
      body('excerpt')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Excerpt must not exceed 500 characters'),
      
      body('status')
            .optional()
            .isIn(['draft', 'published', 'archived'])
            .withMessage('Status must be draft, published, or archived'),
      
      body('kategori')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Category must not exceed 100 characters'),
      
      body('tags')
            .optional()
            .custom((value) => {
                  if (typeof value === 'string') {
                        const tags = value.split(',').map(tag => tag.trim());
                        if (tags.length > 10) {
                              throw new Error('Maximum 10 tags allowed');
                        }
                        if (tags.some(tag => tag.length > 50)) {
                              throw new Error('Each tag must not exceed 50 characters');
                        }
                  } else if (Array.isArray(value)) {
                        if (value.length > 10) {
                              throw new Error('Maximum 10 tags allowed');
                        }
                        if (value.some(tag => typeof tag !== 'string' || tag.length > 50)) {
                              throw new Error('Each tag must be a string and not exceed 50 characters');
                        }
                  }
                  return true;
            }),
      
      body('featured')
            .optional()
            .isBoolean()
            .withMessage('Featured must be a boolean value'),
      
      (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                  return res.status(400).json({
                        success: false,
                        message: 'Validation failed',
                        errors: errors.array()
                  });
            }
            next();
      }
];

export const validateStudent = [
      body('nama')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters')
            .matches(/^[a-zA-Z\s.,'-]+$/)
            .withMessage('Name contains invalid characters'),
      
      body('nisn')
            .trim()
            .isLength({ min: 10, max: 20 })
            .withMessage('NISN must be between 10 and 20 characters')
            .matches(/^[0-9]+$/)
            .withMessage('NISN must contain only numbers'),
      
      body('kelas')
            .optional()
            .trim()
            .isLength({ max: 10 })
            .withMessage('Class must not exceed 10 characters'),
      
      body('status_kelulusan')
            .isBoolean()
            .withMessage('Graduation status must be a boolean'),
      
      body('nilai_rata_rata')
            .optional()
            .isFloat({ min: 0, max: 100 })
            .withMessage('Average score must be between 0 and 100'),
      
      body('catatan')
            .optional()
            .trim()
            .isLength({ max: 1000 })
            .withMessage('Notes must not exceed 1000 characters'),
      
      (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                  return res.status(400).json({
                        success: false,
                        message: 'Validation failed',
                        errors: errors.array()
                  });
            }
            next();
      }
];

export const validateFileUpload = (req: FileUploadRequest, res: Response, next: NextFunction) => {
      // Skip validation if no file uploaded
      if (!req.file) {
            return next();
      }

      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedMimes.includes(req.file.mimetype)) {
            return res.status(400).json({
                  success: false,
                  message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
            });
      }

      if (req.file.size > maxSize) {
            return res.status(400).json({
                  success: false,
                  message: 'File size too large. Maximum size is 5MB.'
            });
      }

      next();
};