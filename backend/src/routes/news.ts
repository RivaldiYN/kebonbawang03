// backend/src/routes/news.ts - Compatible with frontend field names
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as multer from 'multer';
import { query } from '../config/database';
import authMiddleware from '../middleware/auth';

const router = express.Router();

// ✅ FIXED: Update storage path juga untuk konsistensi
const storage = multer.diskStorage({
      destination: (req, file, cb) => {
            // Pastikan path sesuai dengan serving path
            const uploadDir = path.join(__dirname, '../uploads/news');

            // Ensure directory exists
            if (!fs.existsSync(uploadDir)) {
                  fs.mkdirSync(uploadDir, { recursive: true });
                  console.log('📁 Created uploads directory:', uploadDir);
            }
            console.log('📁 Saving to directory:', uploadDir);
            cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            const filename = 'news-' + uniqueSuffix + ext;
            console.log('📸 Saving file as:', filename);
            cb(null, filename);
      }
});

const fileFilter = (req: any, file: any, cb: any) => {
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

      if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
      } else {
            cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
      }
};

const upload = multer({
      storage: storage,
      limits: {
            fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: fileFilter
});

// Middleware for single image upload
const uploadSingle = upload.single('image');

// Error handler middleware
const handleUploadError = (error: any, req: any, res: any, next: any) => {
      console.error('📤 Upload Error:', error);

      if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                  return res.status(400).json({
                        success: false,
                        message: 'File terlalu besar. Maksimal 5MB.'
                  });
            }
      }

      if (error.message && error.message.includes('Only image files')) {
            return res.status(400).json({
                  success: false,
                  message: 'Hanya file gambar yang diizinkan (JPEG, PNG, GIF, WebP).'
            });
      }

      next(error);
};

// Helper function to generate slug
const generateSlug = (title: string): string => {
      return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
};

// Helper function for pagination
const getPagination = (page: number, limit: number) => {
      const offset = (page - 1) * limit;
      return { limit, offset };
};

// Helper function to transform DB row to frontend format
const transformNewsRow = (row: any) => {
      return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            content: row.content,
            excerpt: row.excerpt,
            featured_image: row.featured_image,
            author_id: row.author_id,
            author_name: row.author_name,
            category: row.category,
            tags: row.tags || [],
            status: row.status,
            is_featured: row.is_featured,
            view_count: row.view_count || 0,
            published_at: row.published_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
            // Include category info if available
            category_name: row.category_name,
            category_color: row.category_color
      };
};

// STATIC FILE SERVING - Serve uploaded images (FIXED)
router.get('/images/:filename', (req, res) => {
      try {
            const { filename } = req.params;

            // Security: prevent directory traversal
            if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                  return res.status(400).json({ success: false, message: 'Invalid filename' });
            }

            // ✅ FIXED: Gunakan path yang benar sesuai struktur folder
            // Jika __dirname = backend/src/routes, maka ../uploads/news mengarah ke backend/src/uploads/news
            const imagePath = path.join(__dirname, '../uploads/news', filename);
            console.log('🖼️ Serving image from:', imagePath);

            // Check if file exists
            if (!fs.existsSync(imagePath)) {
                  console.log('❌ Image not found at:', imagePath);
                  return res.status(404).json({ success: false, message: 'Image not found' });
            }

            // Set appropriate headers
            const ext = path.extname(filename).toLowerCase();
            const mimeTypes: { [key: string]: string } = {
                  '.jpg': 'image/jpeg',
                  '.jpeg': 'image/jpeg',
                  '.png': 'image/png',
                  '.gif': 'image/gif',
                  '.webp': 'image/webp'
            };

            const mimeType = mimeTypes[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

            console.log('✅ Successfully serving image:', filename);
            res.sendFile(path.resolve(imagePath));
      } catch (error) {
            console.error('Error serving image:', error);
            res.status(500).json({ success: false, message: 'Failed to serve image' });
      }
});

// UPLOAD ENDPOINTS

// POST /api/news/upload - Upload single image
router.post('/upload', authMiddleware, uploadSingle, handleUploadError, async (req: any, res) => {
      try {
            console.log('📤 Upload request received');
            console.log('📁 File:', req.file);

            if (!req.file) {
                  return res.status(400).json({
                        success: false,
                        message: 'No file uploaded'
                  });
            }

            const imageUrl = `/api/news/images/${req.file.filename}`;
            console.log('✅ Image uploaded successfully:', imageUrl);

            res.json({
                  success: true,
                  message: 'Image uploaded successfully',
                  data: {
                        url: imageUrl,
                        filename: req.file.filename,
                        originalName: req.file.originalname,
                        size: req.file.size
                  }
            });
      } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Failed to upload image'
            });
      }
});

// PUBLIC ROUTES

// GET /api/news/public - Get published news with pagination, category filter, and search
router.get('/public', async (req, res) => {
      try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
            const category = req.query.category as string || '';
            const search = req.query.search as string || '';

            const { offset } = getPagination(page, limit);

            let queryText = `
                  SELECT n.*, nc.name as category_name, nc.color as category_color
                  FROM news n
                  LEFT JOIN news_categories nc ON n.category = nc.slug
                  WHERE n.status = 'published'
            `;

            const queryParams: any[] = [];
            let paramCount = 0;

            if (category) {
                  paramCount++;
                  queryText += ` AND n.category = $${paramCount}`;
                  queryParams.push(category);
            }

            if (search) {
                  paramCount++;
                  queryText += ` AND (n.title ILIKE $${paramCount} OR n.content ILIKE $${paramCount} OR n.excerpt ILIKE $${paramCount})`;
                  queryParams.push(`%${search}%`);
            }

            queryText += ' ORDER BY n.published_at DESC, n.created_at DESC';

            // Count total
            let countQuery = `
                  SELECT COUNT(*) as total
                  FROM news n
                  WHERE n.status = 'published'
            `;

            let countParams: any[] = [];
            let countParamCount = 0;

            if (category) {
                  countParamCount++;
                  countQuery += ` AND n.category = $${countParamCount}`;
                  countParams.push(category);
            }

            if (search) {
                  countParamCount++;
                  countQuery += ` AND (n.title ILIKE $${countParamCount} OR n.content ILIKE $${countParamCount} OR n.excerpt ILIKE $${countParamCount})`;
                  countParams.push(`%${search}%`);
            }

            const [newsResult, countResult] = await Promise.all([
                  query(queryText + ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`, [...queryParams, limit, offset]),
                  query(countQuery, countParams)
            ]);

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            res.json({
                  success: true,
                  data: newsResult.rows.map(transformNewsRow),
                  pagination: {
                        page,
                        limit,
                        total,
                        totalPages
                  }
            });
      } catch (error) {
            console.error('Error fetching published news:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal memuat berita'
            });
      }
});

// GET /api/news/featured - Get featured news
router.get('/featured', async (req, res) => {
      try {
            const limit = Math.min(parseInt(req.query.limit as string) || 3, 10);

            const queryText = `
                  SELECT n.*, nc.name as category_name, nc.color as category_color
                  FROM news n
                  LEFT JOIN news_categories nc ON n.category = nc.slug
                  WHERE n.status = 'published' AND n.is_featured = true
                  ORDER BY n.published_at DESC, n.created_at DESC
                  LIMIT $1
            `;

            const result = await query(queryText, [limit]);

            res.json({
                  success: true,
                  data: result.rows.map(transformNewsRow)
            });
      } catch (error) {
            console.error('Error fetching featured news:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal memuat berita unggulan'
            });
      }
});

// GET /api/news/public/:slug - Get single news by slug
router.get('/public/:slug', async (req, res) => {
      try {
            const { slug } = req.params;

            const queryText = `
                  SELECT n.*, nc.name as category_name, nc.color as category_color
                  FROM news n
                  LEFT JOIN news_categories nc ON n.category = nc.slug
                  WHERE n.slug = $1 AND n.status = 'published'
            `;

            const result = await query(queryText, [slug]);

            if (result.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Berita tidak ditemukan'
                  });
            }

            // Increment view count
            await query(
                  'UPDATE news SET view_count = view_count + 1 WHERE id = $1',
                  [result.rows[0].id]
            );

            res.json({
                  success: true,
                  data: transformNewsRow({ ...result.rows[0], view_count: result.rows[0].view_count + 1 })
            });
      } catch (error) {
            console.error('Error fetching news by slug:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal memuat detail berita'
            });
      }
});

// GET /api/news/categories - Get all news categories
router.get('/categories', async (req, res) => {
      try {
            const queryText = 'SELECT * FROM news_categories ORDER BY name ASC';
            const result = await query(queryText);

            res.json({
                  success: true,
                  data: result.rows
            });
      } catch (error) {
            console.error('Error fetching news categories:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal memuat kategori berita'
            });
      }
});

// ADMIN ROUTES

// GET /api/news - Get all news for admin (with filters)
router.get('/', authMiddleware, async (req, res) => {
      try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
            const status = req.query.status as string || '';
            const search = req.query.search as string || '';

            const { offset } = getPagination(page, limit);

            let queryText = `
                  SELECT n.*, nc.name as category_name, nc.color as category_color,
                         u.username as author_username
                  FROM news n
                  LEFT JOIN news_categories nc ON n.category = nc.slug
                  LEFT JOIN users u ON n.author_id = u.id
                  WHERE 1=1
            `;

            const queryParams: any[] = [];
            let paramCount = 0;

            if (status) {
                  paramCount++;
                  queryText += ` AND n.status = $${paramCount}`;
                  queryParams.push(status);
            }

            if (search) {
                  paramCount++;
                  queryText += ` AND (n.title ILIKE $${paramCount} OR n.content ILIKE $${paramCount} OR n.excerpt ILIKE $${paramCount})`;
                  queryParams.push(`%${search}%`);
            }

            queryText += ' ORDER BY n.created_at DESC';

            // Count total
            let countQuery = `SELECT COUNT(*) as total FROM news n WHERE 1=1`;
            let countParams: any[] = [];
            let countParamCount = 0;

            if (status) {
                  countParamCount++;
                  countQuery += ` AND n.status = $${countParamCount}`;
                  countParams.push(status);
            }

            if (search) {
                  countParamCount++;
                  countQuery += ` AND (n.title ILIKE $${countParamCount} OR n.content ILIKE $${countParamCount} OR n.excerpt ILIKE $${countParamCount})`;
                  countParams.push(`%${search}%`);
            }

            const [newsResult, countResult] = await Promise.all([
                  query(queryText + ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`, [...queryParams, limit, offset]),
                  query(countQuery, countParams)
            ]);

            const total = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(total / limit);

            res.json({
                  success: true,
                  data: newsResult.rows.map(transformNewsRow),
                  pagination: {
                        page,
                        limit,
                        total,
                        totalPages
                  }
            });
      } catch (error) {
            console.error('Error fetching news for admin:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal memuat berita'
            });
      }
});

// POST /api/news - Create new news with optional image upload
router.post('/', authMiddleware, uploadSingle, handleUploadError, async (req: any, res) => {
      try {
            console.log('📤 Create news request received');
            console.log('📁 Body:', req.body);
            console.log('📸 File:', req.file);

            const { title, content, excerpt, category, tags, status, is_featured } = req.body;
            const author_id = req.user?.id;
            const author_name = req.user?.username;

            if (!title || !content || !category) {
                  return res.status(400).json({
                        success: false,
                        message: 'Judul, konten, dan kategori harus diisi'
                  });
            }

            const slug = generateSlug(title);

            // Check if slug already exists
            const existingSlug = await query('SELECT id FROM news WHERE slug = $1', [slug]);
            if (existingSlug.rows.length > 0) {
                  return res.status(400).json({
                        success: false,
                        message: 'Judul sudah digunakan, gunakan judul yang berbeda'
                  });
            }

            // Handle uploaded image
            let featured_image = null;
            if (req.file) {
                  featured_image = `/api/news/images/${req.file.filename}`;
                  console.log('✅ Image saved with URL:', featured_image);
            }

            // Parse tags if it's a JSON string
            let parsedTags = [];
            if (tags) {
                  try {
                        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
                  } catch (e) {
                        parsedTags = [];
                  }
            }

            const queryText = `
                  INSERT INTO news (
                        title, slug, content, excerpt, featured_image, author_id, author_name,
                        category, tags, status, is_featured, published_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                  RETURNING *
            `;

            const published_at = status === 'published' ? new Date() : null;
            const isFeatured = is_featured === 'true' || is_featured === true;

            const result = await query(queryText, [
                  title, slug, content, excerpt, featured_image, author_id, author_name,
                  category, parsedTags, status || 'draft', isFeatured, published_at
            ]);

            console.log('✅ News created successfully:', result.rows[0].id);

            res.status(201).json({
                  success: true,
                  data: transformNewsRow(result.rows[0]),
                  message: 'Berita berhasil dibuat'
            });
      } catch (error) {
            console.error('Error creating news:', error);

            // Clean up uploaded file if error occurs
            if (req.file) {
                  const filePath = req.file.path;
                  if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('🗑️ Cleaned up uploaded file due to error');
                  }
            }

            res.status(500).json({
                  success: false,
                  message: 'Gagal membuat berita: ' + error.message
            });
      }
});

// PUT /api/news/:id - Update news with optional image upload
router.put('/:id', authMiddleware, uploadSingle, handleUploadError, async (req: any, res) => {
      try {
            console.log('📤 Update news request received for ID:', req.params.id);
            console.log('📁 Body:', req.body);
            console.log('📸 File:', req.file);

            const { id } = req.params;
            const { title, content, excerpt, category, tags, status, is_featured } = req.body;

            if (!title || !content || !category) {
                  return res.status(400).json({
                        success: false,
                        message: 'Judul, konten, dan kategori harus diisi'
                  });
            }

            // Check if news exists
            const existingNews = await query('SELECT * FROM news WHERE id = $1', [id]);
            if (existingNews.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Berita tidak ditemukan'
                  });
            }

            const slug = generateSlug(title);

            // Check if slug already exists (excluding current news)
            const existingSlug = await query('SELECT id FROM news WHERE slug = $1 AND id != $2', [slug, id]);
            if (existingSlug.rows.length > 0) {
                  return res.status(400).json({
                        success: false,
                        message: 'Judul sudah digunakan, gunakan judul yang berbeda'
                  });
            }

            let published_at = existingNews.rows[0].published_at;
            let featured_image = existingNews.rows[0].featured_image;

            // If changing from draft to published, set published_at
            if (existingNews.rows[0].status !== 'published' && status === 'published') {
                  published_at = new Date();
            }

            // Handle uploaded image
            if (req.file) {
                  // Delete old image if exists
                  if (existingNews.rows[0].featured_image) {
                        const oldImagePath = path.join(__dirname, '../uploads/news', path.basename(existingNews.rows[0].featured_image));
                        if (fs.existsSync(oldImagePath)) {
                              fs.unlinkSync(oldImagePath);
                              console.log('🗑️ Deleted old image');
                        }
                  }
                  featured_image = `/api/news/images/${req.file.filename}`;
                  console.log('✅ New image saved with URL:', featured_image);
            }

            // Parse tags if it's a JSON string
            let parsedTags = [];
            if (tags) {
                  try {
                        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
                  } catch (e) {
                        parsedTags = [];
                  }
            }

            const queryText = `
                  UPDATE news SET
                        title = $1, slug = $2, content = $3, excerpt = $4, featured_image = $5,
                        category = $6, tags = $7, status = $8, is_featured = $9, published_at = $10,
                        updated_at = CURRENT_TIMESTAMP
                  WHERE id = $11
                  RETURNING *
            `;

            const isFeatured = is_featured === 'true' || is_featured === true;

            const result = await query(queryText, [
                  title, slug, content, excerpt, featured_image,
                  category, parsedTags, status || 'draft', isFeatured, published_at, id
            ]);

            console.log('✅ News updated successfully:', id);

            res.json({
                  success: true,
                  data: transformNewsRow(result.rows[0]),
                  message: 'Berita berhasil diperbarui'
            });
      } catch (error) {
            console.error('Error updating news:', error);

            // Clean up uploaded file if error occurs
            if (req.file) {
                  const filePath = req.file.path;
                  if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('🗑️ Cleaned up uploaded file due to error');
                  }
            }

            res.status(500).json({
                  success: false,
                  message: 'Gagal memperbarui berita: ' + error.message
            });
      }
});

// PATCH routes and other endpoints remain the same...
// (Copy the rest from previous version - PATCH publish, unpublish, toggle-featured, DELETE, etc.)

// PATCH /api/news/:id/publish - Publish news
router.patch('/:id/publish', authMiddleware, async (req, res) => {
      try {
            const { id } = req.params;

            const queryText = `
                  UPDATE news SET
                        status = 'published',
                        published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
                        updated_at = CURRENT_TIMESTAMP
                  WHERE id = $1
                  RETURNING *
            `;

            const result = await query(queryText, [id]);

            if (result.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Berita tidak ditemukan'
                  });
            }

            res.json({
                  success: true,
                  data: transformNewsRow(result.rows[0]),
                  message: 'Berita berhasil dipublish'
            });
      } catch (error) {
            console.error('Error publishing news:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal mempublish berita'
            });
      }
});

// PATCH /api/news/:id/unpublish - Unpublish news
router.patch('/:id/unpublish', authMiddleware, async (req, res) => {
      try {
            const { id } = req.params;

            const queryText = `
                  UPDATE news SET
                        status = 'draft',
                        updated_at = CURRENT_TIMESTAMP
                  WHERE id = $1
                  RETURNING *
            `;

            const result = await query(queryText, [id]);

            if (result.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Berita tidak ditemukan'
                  });
            }

            res.json({
                  success: true,
                  data: transformNewsRow(result.rows[0]),
                  message: 'Berita berhasil di-unpublish'
            });
      } catch (error) {
            console.error('Error unpublishing news:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal meng-unpublish berita'
            });
      }
});

// PATCH /api/news/:id/toggle-featured - Toggle featured status
router.patch('/:id/toggle-featured', authMiddleware, async (req, res) => {
      try {
            const { id } = req.params;

            const queryText = `
                  UPDATE news SET
                        is_featured = NOT is_featured,
                        updated_at = CURRENT_TIMESTAMP
                  WHERE id = $1
                  RETURNING *
            `;

            const result = await query(queryText, [id]);

            if (result.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Berita tidak ditemukan'
                  });
            }

            res.json({
                  success: true,
                  data: transformNewsRow(result.rows[0]),
                  message: `Berita ${result.rows[0].is_featured ? 'ditambahkan ke' : 'dihapus dari'} unggulan`
            });
      } catch (error) {
            console.error('Error toggling featured status:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal mengubah status unggulan'
            });
      }
});

// GET /api/news/stats - Get news statistics
router.get('/stats', authMiddleware, async (req, res) => {
      try {
            const queries = [
                  'SELECT COUNT(*) as total FROM news',
                  'SELECT COUNT(*) as published FROM news WHERE status = \'published\'',
                  'SELECT COUNT(*) as draft FROM news WHERE status = \'draft\'',
                  'SELECT COUNT(*) as featured FROM news WHERE is_featured = true'
            ];

            const results = await Promise.all(queries.map(q => query(q)));

            res.json({
                  success: true,
                  data: {
                        total: parseInt(results[0].rows[0].total),
                        published: parseInt(results[1].rows[0].published),
                        draft: parseInt(results[2].rows[0].draft),
                        featured: parseInt(results[3].rows[0].featured)
                  }
            });
      } catch (error) {
            console.error('Error fetching news stats:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal memuat statistik berita'
            });
      }
});

// GET /api/news/:id - Get single news by ID (admin)
router.get('/:id', authMiddleware, async (req, res) => {
      try {
            const { id } = req.params;

            const queryText = `
                  SELECT n.*, nc.name as category_name, nc.color as category_color,
                         u.username as author_username
                  FROM news n
                  LEFT JOIN news_categories nc ON n.category = nc.slug
                  LEFT JOIN users u ON n.author_id = u.id
                  WHERE n.id = $1
            `;

            const result = await query(queryText, [id]);

            if (result.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Berita tidak ditemukan'
                  });
            }

            res.json({
                  success: true,
                  data: transformNewsRow(result.rows[0])
            });
      } catch (error) {
            console.error('Error fetching news by ID:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal memuat detail berita'
            });
      }
});

// DELETE /api/news/:id - Delete news
router.delete('/:id', authMiddleware, async (req, res) => {
      try {
            const { id } = req.params;

            // Get news details first to delete associated image
            const newsResult = await query('SELECT featured_image FROM news WHERE id = $1', [id]);

            if (newsResult.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Berita tidak ditemukan'
                  });
            }

            // Delete associated image file
            const featuredImage = newsResult.rows[0].featured_image;
            if (featuredImage) {
                  const imagePath = path.join(__dirname, '../uploads/news', path.basename(featuredImage));
                  if (fs.existsSync(imagePath)) {
                        fs.unlinkSync(imagePath);
                        console.log('🗑️ Deleted associated image');
                  }
            }

            // Delete news from database
            await query('DELETE FROM news WHERE id = $1', [id]);

            res.json({
                  success: true,
                  message: 'Berita berhasil dihapus'
            });
      } catch (error) {
            console.error('Error deleting news:', error);
            res.status(500).json({
                  success: false,
                  message: 'Gagal menghapus berita'
            });
      }
});

export default router;