// models/newsModel.ts
import { query } from '../config/database';
import { News, NewsFilter, PaginationInfo, NewsStats } from '../types';

export class NewsModel {
      
      static async createNewsTable(): Promise<void> {
            const createTableQuery = `
                  CREATE TABLE IF NOT EXISTS news (
                        id SERIAL PRIMARY KEY,
                        judul VARCHAR(255) NOT NULL,
                        slug VARCHAR(255) UNIQUE NOT NULL,
                        gambar_url TEXT,
                        isi_content TEXT NOT NULL,
                        excerpt TEXT,
                        status VARCHAR(20) DEFAULT 'draft',
                        tanggal_rilis TIMESTAMP,
                        dibuat_oleh INTEGER REFERENCES users(id),
                        views INTEGER DEFAULT 0,
                        tags TEXT[],
                        kategori VARCHAR(100),
                        featured BOOLEAN DEFAULT false,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                  );
            `;

            const createIndexQuery = `
                  CREATE INDEX IF NOT EXISTS idx_news_slug ON news(slug);
                  CREATE INDEX IF NOT EXISTS idx_news_status ON news(status);
                  CREATE INDEX IF NOT EXISTS idx_news_tanggal_rilis ON news(tanggal_rilis);
                  CREATE INDEX IF NOT EXISTS idx_news_kategori ON news(kategori);
                  CREATE INDEX IF NOT EXISTS idx_news_featured ON news(featured);
            `;

            const createCategoriesTable = `
                  CREATE TABLE IF NOT EXISTS news_categories (
                        id SERIAL PRIMARY KEY,
                        nama_kategori VARCHAR(100) UNIQUE NOT NULL,
                        slug VARCHAR(100) UNIQUE NOT NULL,
                        deskripsi TEXT,
                        color VARCHAR(7) DEFAULT '#3b82f6',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                  );
            `;

            await query(createTableQuery);
            await query(createIndexQuery);
            await query(createCategoriesTable);
            
            // Insert default categories
            await this.insertDefaultCategories();
      }

      private static async insertDefaultCategories(): Promise<void> {
            const categories = [
                  { nama: 'Pengumuman', slug: 'pengumuman', deskripsi: 'Pengumuman resmi sekolah', color: '#ef4444' },
                  { nama: 'Kegiatan', slug: 'kegiatan', deskripsi: 'Kegiatan sekolah dan ekstrakurikuler', color: '#10b981' },
                  { nama: 'Prestasi', slug: 'prestasi', deskripsi: 'Prestasi siswa dan sekolah', color: '#f59e0b' },
                  { nama: 'Akademik', slug: 'akademik', deskripsi: 'Informasi akademik dan pembelajaran', color: '#8b5cf6' },
                  { nama: 'Umum', slug: 'umum', deskripsi: 'Informasi umum sekolah', color: '#6b7280' }
            ];

            for (const category of categories) {
                  const exists = await query('SELECT id FROM news_categories WHERE slug = $1', [category.slug]);
                  if (exists.rows.length === 0) {
                        await query(
                              'INSERT INTO news_categories (nama_kategori, slug, deskripsi, color) VALUES ($1, $2, $3, $4)',
                              [category.nama, category.slug, category.deskripsi, category.color]
                        );
                  }
            }
      }

      static generateSlug(title: string): string {
            return title
                  .toLowerCase()
                  .replace(/[^a-z0-9\s-]/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/-+/g, '-')
                  .trim();
      }

      static generateExcerpt(content: string, maxLength: number = 150): string {
            // Remove HTML tags
            const plainText = content.replace(/<[^>]*>/g, '').trim();
            
            if (plainText.length <= maxLength) {
                  return plainText;
            }

            const truncated = plainText.substring(0, maxLength);
            const lastSpaceIndex = truncated.lastIndexOf(' ');
            
            return lastSpaceIndex > 0 
                  ? truncated.substring(0, lastSpaceIndex) + '...'
                  : truncated + '...';
      }

      static async create(newsData: Omit<News, 'id'>): Promise<News> {
            const {
                  judul,
                  slug,
                  gambar_url,
                  isi_content,
                  excerpt,
                  status = 'draft',
                  tanggal_rilis,
                  dibuat_oleh,
                  tags = [],
                  kategori,
                  featured = false
            } = newsData;

            // Ensure unique slug
            const uniqueSlug = await this.ensureUniqueSlug(slug);
            const autoExcerpt = excerpt || this.generateExcerpt(isi_content);

            const result = await query(`
                  INSERT INTO news (
                        judul, slug, gambar_url, isi_content, excerpt, status, 
                        tanggal_rilis, dibuat_oleh, tags, kategori, featured
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                  RETURNING *
            `, [
                  judul, uniqueSlug, gambar_url, isi_content, autoExcerpt, status,
                  tanggal_rilis, dibuat_oleh, tags, kategori, featured
            ]);

            return result.rows[0];
      }

      static async findById(id: number): Promise<News | null> {
            const result = await query(`
                  SELECT n.*, u.username as admin_name 
                  FROM news n 
                  LEFT JOIN users u ON n.dibuat_oleh = u.id 
                  WHERE n.id = $1
            `, [id]);

            return result.rows[0] || null;
      }

      static async findBySlug(slug: string): Promise<News | null> {
            const result = await query(`
                  SELECT n.*, u.username as admin_name 
                  FROM news n 
                  LEFT JOIN users u ON n.dibuat_oleh = u.id 
                  WHERE n.slug = $1
            `, [slug]);

            return result.rows[0] || null;
      }

      static async findAll(filter: NewsFilter = {}): Promise<{ news: News[], pagination: PaginationInfo }> {
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
            } = filter;

            let whereConditions: string[] = [];
            let queryParams: any[] = [];
            let paramCount = 0;

            if (kategori) {
                  whereConditions.push(`n.kategori = $${++paramCount}`);
                  queryParams.push(kategori);
            }

            if (status) {
                  whereConditions.push(`n.status = $${++paramCount}`);
                  queryParams.push(status);
            }

            if (author) {
                  whereConditions.push(`u.username ILIKE $${++paramCount}`);
                  queryParams.push(`%${author}%`);
            }

            if (search) {
                  whereConditions.push(`(n.judul ILIKE $${++paramCount} OR n.isi_content ILIKE $${++paramCount})`);
                  queryParams.push(`%${search}%`, `%${search}%`);
                  paramCount++;
            }

            if (startDate) {
                  whereConditions.push(`n.tanggal_rilis >= $${++paramCount}`);
                  queryParams.push(startDate);
            }

            if (endDate) {
                  whereConditions.push(`n.tanggal_rilis <= $${++paramCount}`);
                  queryParams.push(endDate);
            }

            if (featured !== undefined) {
                  whereConditions.push(`n.featured = $${++paramCount}`);
                  queryParams.push(featured);
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
            
            // Count total records
            const countResult = await query(`
                  SELECT COUNT(*) as total 
                  FROM news n 
                  LEFT JOIN users u ON n.dibuat_oleh = u.id 
                  ${whereClause}
            `, queryParams);

            const totalCount = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(totalCount / limit);
            const offset = (page - 1) * limit;

            // Get paginated results
            const validSortColumns = ['created_at', 'tanggal_rilis', 'views', 'judul'];
            const sortColumn = validSortColumns.includes(sortBy) ? `n.${sortBy}` : 'n.created_at';
            const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

            const result = await query(`
                  SELECT n.*, u.username as admin_name 
                  FROM news n 
                  LEFT JOIN users u ON n.dibuat_oleh = u.id 
                  ${whereClause}
                  ORDER BY ${sortColumn} ${order}
                  LIMIT $${++paramCount} OFFSET $${++paramCount}
            `, [...queryParams, limit, offset]);

            return {
                  news: result.rows,
                  pagination: {
                        currentPage: page,
                        totalPages,
                        totalCount,
                        limit
                  }
            };
      }

      static async update(id: number, newsData: Partial<News>): Promise<News | null> {
            const {
                  judul,
                  slug,
                  gambar_url,
                  isi_content,
                  excerpt,
                  status,
                  tanggal_rilis,
                  tags,
                  kategori,
                  featured
            } = newsData;

            let updateFields: string[] = [];
            let queryParams: any[] = [];
            let paramCount = 0;

            if (judul !== undefined) {
                  updateFields.push(`judul = $${++paramCount}`);
                  queryParams.push(judul);
            }

            if (slug !== undefined) {
                  const uniqueSlug = await this.ensureUniqueSlug(slug, id);
                  updateFields.push(`slug = $${++paramCount}`);
                  queryParams.push(uniqueSlug);
            }

            if (gambar_url !== undefined) {
                  updateFields.push(`gambar_url = $${++paramCount}`);
                  queryParams.push(gambar_url);
            }

            if (isi_content !== undefined) {
                  updateFields.push(`isi_content = $${++paramCount}`);
                  queryParams.push(isi_content);
                  
                  // Auto-generate excerpt if not provided
                  if (excerpt === undefined) {
                        updateFields.push(`excerpt = $${++paramCount}`);
                        queryParams.push(this.generateExcerpt(isi_content));
                  }
            }

            if (excerpt !== undefined) {
                  updateFields.push(`excerpt = $${++paramCount}`);
                  queryParams.push(excerpt);
            }

            if (status !== undefined) {
                  updateFields.push(`status = $${++paramCount}`);
                  queryParams.push(status);
                  
                  // Set tanggal_rilis when publishing
                  if (status === 'published' && tanggal_rilis === undefined) {
                        updateFields.push(`tanggal_rilis = $${++paramCount}`);
                        queryParams.push(new Date());
                  }
            }

            if (tanggal_rilis !== undefined) {
                  updateFields.push(`tanggal_rilis = $${++paramCount}`);
                  queryParams.push(tanggal_rilis);
            }

            if (tags !== undefined) {
                  updateFields.push(`tags = $${++paramCount}`);
                  queryParams.push(tags);
            }

            if (kategori !== undefined) {
                  updateFields.push(`kategori = $${++paramCount}`);
                  queryParams.push(kategori);
            }

            if (featured !== undefined) {
                  updateFields.push(`featured = $${++paramCount}`);
                  queryParams.push(featured);
            }

            if (updateFields.length === 0) {
                  return await this.findById(id);
            }

            updateFields.push(`updated_at = $${++paramCount}`);
            queryParams.push(new Date());

            const result = await query(`
                  UPDATE news 
                  SET ${updateFields.join(', ')}
                  WHERE id = $${++paramCount}
                  RETURNING *
            `, [...queryParams, id]);

            return result.rows[0] || null;
      }

      static async delete(id: number): Promise<boolean> {
            const result = await query('DELETE FROM news WHERE id = $1', [id]);
            return result.rowCount > 0;
      }

      static async incrementViews(id: number): Promise<void> {
            await query('UPDATE news SET views = views + 1 WHERE id = $1', [id]);
      }

      static async getPublished(limit?: number): Promise<News[]> {
            const limitClause = limit ? `LIMIT ${limit}` : '';
            
            const result = await query(`
                  SELECT n.*, u.username as admin_name 
                  FROM news n 
                  LEFT JOIN users u ON n.dibuat_oleh = u.id 
                  WHERE n.status = 'published'
                  ORDER BY n.tanggal_rilis DESC, n.created_at DESC
                  ${limitClause}
            `);

            return result.rows;
      }

      static async getFeatured(limit: number = 3): Promise<News[]> {
            const result = await query(`
                  SELECT n.*, u.username as admin_name 
                  FROM news n 
                  LEFT JOIN users u ON n.dibuat_oleh = u.id 
                  WHERE n.status = 'published' AND n.featured = true
                  ORDER BY n.tanggal_rilis DESC, n.created_at DESC
                  LIMIT $1
            `, [limit]);

            return result.rows;
      }

      static async getStats(): Promise<NewsStats> {
            const statsResult = await query(`
                  SELECT 
                        COUNT(*) as total_news,
                        COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
                        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
                        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived,
                        COALESCE(SUM(views), 0) as total_views
                  FROM news
            `);

            const mostViewedResult = await query(`
                  SELECT n.*, u.username as admin_name 
                  FROM news n 
                  LEFT JOIN users u ON n.dibuat_oleh = u.id 
                  WHERE n.status = 'published'
                  ORDER BY n.views DESC 
                  LIMIT 5
            `);

            const recentResult = await query(`
                  SELECT n.*, u.username as admin_name 
                  FROM news n 
                  LEFT JOIN users u ON n.dibuat_oleh = u.id 
                  WHERE n.status = 'published'
                  ORDER BY n.tanggal_rilis DESC, n.created_at DESC 
                  LIMIT 5
            `);

            const stats = statsResult.rows[0];

            return {
                  total_news: parseInt(stats.total_news),
                  published: parseInt(stats.published),
                  draft: parseInt(stats.draft),
                  archived: parseInt(stats.archived),
                  total_views: parseInt(stats.total_views),
                  most_viewed: mostViewedResult.rows,
                  recent_news: recentResult.rows
            };
      }

      static async getCategories(): Promise<any[]> {
            const result = await query(`
                  SELECT c.*, COUNT(n.id) as news_count 
                  FROM news_categories c 
                  LEFT JOIN news n ON c.slug = n.kategori AND n.status = 'published'
                  GROUP BY c.id, c.nama_kategori, c.slug, c.deskripsi, c.color, c.created_at
                  ORDER BY c.nama_kategori
            `);

            return result.rows;
      }

      private static async ensureUniqueSlug(baseSlug: string, excludeId?: number): Promise<string> {
            let slug = baseSlug;
            let counter = 1;

            while (true) {
                  const condition = excludeId 
                        ? 'slug = $1 AND id != $2' 
                        : 'slug = $1';
                  const params = excludeId 
                        ? [slug, excludeId] 
                        : [slug];

                  const result = await query(`SELECT id FROM news WHERE ${condition}`, params);

                  if (result.rows.length === 0) {
                        return slug;
                  }

                  slug = `${baseSlug}-${counter}`;
                  counter++;
            }
      }
}