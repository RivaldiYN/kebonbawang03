// controllers/newsController.ts
import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { NewsModel } from '../models/News';
import { AuthRequest, News, NewsFilter } from '../types';

export class NewsController {
      
      /**
       * Get all published news with pagination and filters (Public)
       */
      static async getPublishedNews(req: Request, res: Response) {
            try {
                  const {
                        kategori,
                        search,
                        startDate,
                        endDate,
                        page = 1,
                        limit = 10,
                        sortBy = 'tanggal_rilis',
                        sortOrder = 'DESC'
                  } = req.query;

                  const filter: NewsFilter = {
                        status: 'published',
                        kategori: kategori as string,
                        search: search as string,
                        startDate: startDate ? new Date(startDate as string) : undefined,
                        endDate: endDate ? new Date(endDate as string) : undefined,
                        page: parseInt(page as string),
                        limit: Math.min(parseInt(limit as string), 50), // Max 50 per page
                        sortBy: sortBy as any,
                        sortOrder: sortOrder as any
                  };

                  const result = await NewsModel.findAll(filter);

                  res.json({
                        success: true,
                        message: 'News retrieved successfully',
                        data: result.news,
                        pagination: result.pagination
                  });
            } catch (error) {
                  console.error('Get published news error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to retrieve news'
                  });
            }
      }

      /**
       * Get featured news (Public)
       */
      static async getFeaturedNews(req: Request, res: Response) {
            try {
                  const { limit = 3 } = req.query;
                  const featuredNews = await NewsModel.getFeatured(parseInt(limit as string));

                  res.json({
                        success: true,
                        message: 'Featured news retrieved successfully',
                        data: featuredNews
                  });
            } catch (error) {
                  console.error('Get featured news error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to retrieve featured news'
                  });
            }
      }

      /**
       * Get news by ID or slug (Public)
       */
      static async getNewsByIdentifier(req: Request, res: Response) {
            try {
                  const { identifier } = req.params;
                  
                  let news: News | null;
                  
                  // Check if identifier is numeric (ID) or string (slug)
                  if (/^\d+$/.test(identifier)) {
                        news = await NewsModel.findById(parseInt(identifier));
                  } else {
                        news = await NewsModel.findBySlug(identifier);
                  }

                  if (!news) {
                        return res.status(404).json({
                              success: false,
                              message: 'News not found'
                        });
                  }

                  // Only allow published news for public access
                  if (news.status !== 'published') {
                        return res.status(404).json({
                              success: false,
                              message: 'News not found'
                        });
                  }

                  // Increment view count
                  await NewsModel.incrementViews(news.id!);
                  news.views = (news.views || 0) + 1;

                  res.json({
                        success: true,
                        message: 'News retrieved successfully',
                        data: news
                  });
            } catch (error) {
                  console.error('Get news by identifier error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to retrieve news'
                  });
            }
      }

      /**
       * Get all news categories (Public)
       */
      static async getCategories(req: Request, res: Response) {
            try {
                  const categories = await NewsModel.getCategories();

                  res.json({
                        success: true,
                        message: 'Categories retrieved successfully',
                        data: categories
                  });
            } catch (error) {
                  console.error('Get categories error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to retrieve categories'
                  });
            }
      }

      /**
       * Get all news for admin (including drafts)
       */
      static async getAllNewsAdmin(req: AuthRequest, res: Response) {
            try {
                  const {
                        kategori,
                        status,
                        author,
                        search,
                        startDate,
                        endDate,
                        featured,
                        page = 1,
                        limit = 10,
                        sortBy = 'created_at',
                        sortOrder = 'DESC'
                  } = req.query;

                  const filter: NewsFilter = {
                        kategori: kategori as string,
                        status: status as any,
                        author: author as string,
                        search: search as string,
                        startDate: startDate ? new Date(startDate as string) : undefined,
                        endDate: endDate ? new Date(endDate as string) : undefined,
                        featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
                        page: parseInt(page as string),
                        limit: Math.min(parseInt(limit as string), 100),
                        sortBy: sortBy as any,
                        sortOrder: sortOrder as any
                  };

                  const result = await NewsModel.findAll(filter);

                  res.json({
                        success: true,
                        message: 'News retrieved successfully',
                        data: result.news,
                        pagination: result.pagination
                  });
            } catch (error) {
                  console.error('Get all news admin error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to retrieve news'
                  });
            }
      }

      /**
       * Get news statistics
       */
      static async getNewsStats(req: AuthRequest, res: Response) {
            try {
                  const stats = await NewsModel.getStats();

                  res.json({
                        success: true,
                        message: 'News statistics retrieved successfully',
                        data: stats
                  });
            } catch (error) {
                  console.error('Get news stats error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to retrieve news statistics'
                  });
            }
      }

      /**
       * Create new news article
       */
      static async createNews(req: AuthRequest, res: Response) {
            try {
                  const {
                        judul,
                        isi_content,
                        excerpt,
                        status = 'draft',
                        kategori,
                        tags,
                        featured = false
                  } = req.body;

                  if (!judul || !isi_content) {
                        return res.status(400).json({
                              success: false,
                              message: 'Title and content are required'
                        });
                  }

                  const slug = NewsModel.generateSlug(judul);
                  let gambar_url = null;

                  // Handle uploaded image
                  if (req.file) {
                        gambar_url = `/api/news/images/${req.file.filename}`;
                  }

                  const newsData: Omit<News, 'id'> = {
                        judul,
                        slug,
                        gambar_url,
                        isi_content,
                        excerpt,
                        status,
                        tanggal_rilis: status === 'published' ? new Date() : undefined,
                        dibuat_oleh: req.user!.id,
                        views: 0,
                        tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim())) : [],
                        kategori,
                        featured: Boolean(featured)
                  };

                  const news = await NewsModel.create(newsData);

                  res.status(201).json({
                        success: true,
                        message: 'News created successfully',
                        data: news
                  });
            } catch (error) {
                  console.error('Create news error:', error);
                  
                  // Clean up uploaded file if error occurs
                  if (req.file) {
                        const filePath = req.file.path;
                        if (fs.existsSync(filePath)) {
                              fs.unlinkSync(filePath);
                        }
                  }

                  res.status(500).json({
                        success: false,
                        message: 'Failed to create news'
                  });
            }
      }

      /**
       * Update news article
       */
      static async updateNews(req: AuthRequest, res: Response) {
            try {
                  const { id } = req.params;
                  const newsId = parseInt(id);

                  const existingNews = await NewsModel.findById(newsId);
                  if (!existingNews) {
                        return res.status(404).json({
                              success: false,
                              message: 'News not found'
                        });
                  }

                  const {
                        judul,
                        isi_content,
                        excerpt,
                        status,
                        kategori,
                        tags,
                        featured
                  } = req.body;

                  const updateData: Partial<News> = {};

                  if (judul !== undefined) {
                        updateData.judul = judul;
                        updateData.slug = NewsModel.generateSlug(judul);
                  }

                  if (isi_content !== undefined) updateData.isi_content = isi_content;
                  if (excerpt !== undefined) updateData.excerpt = excerpt;
                  if (status !== undefined) {
                        updateData.status = status;
                        if (status === 'published' && !existingNews.tanggal_rilis) {
                              updateData.tanggal_rilis = new Date();
                        }
                  }
                  if (kategori !== undefined) updateData.kategori = kategori;
                  if (tags !== undefined) {
                        updateData.tags = Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim());
                  }
                  if (featured !== undefined) updateData.featured = Boolean(featured);

                  // Handle uploaded image
                  if (req.file) {
                        // Delete old image if exists
                        if (existingNews.gambar_url) {
                              const oldImagePath = path.join(__dirname, '../uploads/news', path.basename(existingNews.gambar_url));
                              if (fs.existsSync(oldImagePath)) {
                                    fs.unlinkSync(oldImagePath);
                              }
                        }
                        updateData.gambar_url = `/api/news/images/${req.file.filename}`;
                  }

                  const updatedNews = await NewsModel.update(newsId, updateData);

                  res.json({
                        success: true,
                        message: 'News updated successfully',
                        data: updatedNews
                  });
            } catch (error) {
                  console.error('Update news error:', error);
                  
                  // Clean up uploaded file if error occurs
                  if (req.file) {
                        const filePath = req.file.path;
                        if (fs.existsSync(filePath)) {
                              fs.unlinkSync(filePath);
                        }
                  }

                  res.status(500).json({
                        success: false,
                        message: 'Failed to update news'
                  });
            }
      }

      /**
       * Delete news article
       */
      static async deleteNews(req: AuthRequest, res: Response) {
            try {
                  const { id } = req.params;
                  const newsId = parseInt(id);

                  const existingNews = await NewsModel.findById(newsId);
                  if (!existingNews) {
                        return res.status(404).json({
                              success: false,
                              message: 'News not found'
                        });
                  }

                  // Delete associated image
                  if (existingNews.gambar_url) {
                        const imagePath = path.join(__dirname, '../uploads/news', path.basename(existingNews.gambar_url));
                        if (fs.existsSync(imagePath)) {
                              fs.unlinkSync(imagePath);
                        }
                  }

                  const deleted = await NewsModel.delete(newsId);
                  
                  if (!deleted) {
                        return res.status(404).json({
                              success: false,
                              message: 'News not found'
                        });
                  }

                  res.json({
                        success: true,
                        message: 'News deleted successfully'
                  });
            } catch (error) {
                  console.error('Delete news error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to delete news'
                  });
            }
      }

      /**
       * Toggle publish status
       */
      static async togglePublishStatus(req: AuthRequest, res: Response) {
            try {
                  const { id } = req.params;
                  const { status } = req.body;
                  const newsId = parseInt(id);

                  const validStatuses = ['draft', 'published', 'archived'];
                  if (!validStatuses.includes(status)) {
                        return res.status(400).json({
                              success: false,
                              message: 'Invalid status. Must be draft, published, or archived'
                        });
                  }

                  const existingNews = await NewsModel.findById(newsId);
                  if (!existingNews) {
                        return res.status(404).json({
                              success: false,
                              message: 'News not found'
                        });
                  }

                  const updateData: Partial<News> = { status };
                  
                  // Set tanggal_rilis when publishing for the first time
                  if (status === 'published' && !existingNews.tanggal_rilis) {
                        updateData.tanggal_rilis = new Date();
                  }

                  const updatedNews = await NewsModel.update(newsId, updateData);

                  res.json({
                        success: true,
                        message: `News ${status} successfully`,
                        data: updatedNews
                  });
            } catch (error) {
                  console.error('Toggle publish status error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to update news status'
                  });
            }
      }

      /**
       * Toggle featured status
       */
      static async toggleFeaturedStatus(req: AuthRequest, res: Response) {
            try {
                  const { id } = req.params;
                  const { featured } = req.body;
                  const newsId = parseInt(id);

                  const existingNews = await NewsModel.findById(newsId);
                  if (!existingNews) {
                        return res.status(404).json({
                              success: false,
                              message: 'News not found'
                        });
                  }

                  const updatedNews = await NewsModel.update(newsId, { featured: Boolean(featured) });

                  res.json({
                        success: true,
                        message: `News ${featured ? 'featured' : 'unfeatured'} successfully`,
                        data: updatedNews
                  });
            } catch (error) {
                  console.error('Toggle featured status error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to update featured status'
                  });
            }
      }

      /**
       * Upload image for rich text editor
       */
      static async uploadImage(req: AuthRequest, res: Response) {
            try {
                  if (!req.file) {
                        return res.status(400).json({
                              success: false,
                              message: 'No image file uploaded'
                        });
                  }

                  const imageUrl = `/api/news/images/${req.file.filename}`;

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
                  console.error('Upload image error:', error);
                  
                  // Clean up uploaded file if error occurs
                  if (req.file) {
                        const filePath = req.file.path;
                        if (fs.existsSync(filePath)) {
                              fs.unlinkSync(filePath);
                        }
                  }

                  res.status(500).json({
                        success: false,
                        message: 'Failed to upload image'
                  });
            }
      }

      /**
       * Delete uploaded image
       */
      static async deleteImage(req: AuthRequest, res: Response) {
            try {
                  const { filename } = req.params;
                  
                  // Validate filename to prevent directory traversal
                  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
                        return res.status(400).json({
                              success: false,
                              message: 'Invalid filename'
                        });
                  }

                  const imagePath = path.join(__dirname, '../uploads/news', filename);
                  
                  if (!fs.existsSync(imagePath)) {
                        return res.status(404).json({
                              success: false,
                              message: 'Image not found'
                        });
                  }

                  fs.unlinkSync(imagePath);

                  res.json({
                        success: true,
                        message: 'Image deleted successfully'
                  });
            } catch (error) {
                  console.error('Delete image error:', error);
                  res.status(500).json({
                        success: false,
                        message: 'Failed to delete image'
                  });
            }
      }
}