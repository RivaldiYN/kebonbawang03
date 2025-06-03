//backend/src/config/database.ts
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// Pastikan semua environment variables dikonversi ke string
const dbConfig = {
      user: String(process.env.DB_USER || 'postgres'),
      host: String(process.env.DB_HOST || 'localhost'),
      database: String(process.env.DB_NAME || 'school'),
      password: String(process.env.DB_PASSWORD || '123'),
      port: parseInt(String(process.env.DB_PORT || '5432')),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
};

console.log('Database config:', {
      user: dbConfig.user,
      host: dbConfig.host,
      database: dbConfig.database,
      password: '***hidden***',
      port: dbConfig.port
});

const pool = new Pool(dbConfig);

export const query = (text: string, params?: any[]) => {
      return pool.query(text, params);
};

export const getClient = () => {
      return pool.connect();
};

export const initDatabase = async () => {
      try {
            // Test connection
            const client = await pool.connect();
            const result = await client.query('SELECT NOW()');
            client.release();

            console.log('Database connection successful:', result.rows[0].now);

            // Create tables if they don't exist
            await createTables();

            console.log('Database initialized successfully');
      } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
      }
};

const createTables = async () => {
      const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

      const createStudentsTable = `
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      nama VARCHAR(100) NOT NULL,
      nisn VARCHAR(20) UNIQUE NOT NULL,
      kelas VARCHAR(10),
      status_kelulusan BOOLEAN NOT NULL DEFAULT false,
      nilai_rata_rata DECIMAL(4,2),
      catatan TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

      const createSchoolInfoTable = `
    CREATE TABLE IF NOT EXISTS school_info (
      id SERIAL PRIMARY KEY,
      nama_sekolah VARCHAR(200) NOT NULL,
      alamat TEXT,
      telepon VARCHAR(20),
      email VARCHAR(100),
      kepala_sekolah VARCHAR(100),
      tahun_ajaran VARCHAR(20),
      tentang_sekolah TEXT,
      visi TEXT,
      misi TEXT,
      logo_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

      // Tabel News baru
      const createNewsTable = `
    CREATE TABLE IF NOT EXISTS news (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      featured_image VARCHAR(500),
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name VARCHAR(100),
      category VARCHAR(50) DEFAULT 'umum',
      tags TEXT[], -- Array of tags
      status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
      is_featured BOOLEAN DEFAULT false,
      view_count INTEGER DEFAULT 0,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

      // Tabel untuk kategori news (opsional)
      const createNewsCategoriesTable = `
    CREATE TABLE IF NOT EXISTS news_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      slug VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      color VARCHAR(7) DEFAULT '#007bff', -- Hex color code
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

      const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_students_nisn ON students(nisn);
    CREATE INDEX IF NOT EXISTS idx_students_nama ON students(nama);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(status_kelulusan);
    
    -- Indexes untuk news
    CREATE INDEX IF NOT EXISTS idx_news_slug ON news(slug);
    CREATE INDEX IF NOT EXISTS idx_news_status ON news(status);
    CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);
    CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at);
    CREATE INDEX IF NOT EXISTS idx_news_author_id ON news(author_id);
    CREATE INDEX IF NOT EXISTS idx_news_featured ON news(is_featured);
    CREATE INDEX IF NOT EXISTS idx_news_tags ON news USING GIN(tags);
    
    -- Indexes untuk news categories
    CREATE INDEX IF NOT EXISTS idx_news_categories_slug ON news_categories(slug);
  `;

      // Function untuk auto-update updated_at
      const createUpdateTriggerFunction = `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `;

      // Triggers untuk auto-update updated_at
      const createTriggers = `
    -- Trigger untuk users
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    -- Trigger untuk students
    DROP TRIGGER IF EXISTS update_students_updated_at ON students;
    CREATE TRIGGER update_students_updated_at 
        BEFORE UPDATE ON students 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    -- Trigger untuk school_info
    DROP TRIGGER IF EXISTS update_school_info_updated_at ON school_info;
    CREATE TRIGGER update_school_info_updated_at 
        BEFORE UPDATE ON school_info 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    -- Trigger untuk news
    DROP TRIGGER IF EXISTS update_news_updated_at ON news;
    CREATE TRIGGER update_news_updated_at 
        BEFORE UPDATE ON news 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `;

      try {
            await pool.query(createUsersTable);
            await pool.query(createStudentsTable);
            await pool.query(createSchoolInfoTable);
            await pool.query(createNewsTable);
            await pool.query(createNewsCategoriesTable);
            await pool.query(createIndexes);
            await pool.query(createUpdateTriggerFunction);
            await pool.query(createTriggers);

            // Insert default data
            await insertDefaultData();

            console.log('Tables created successfully');
      } catch (error) {
            console.error('Error creating tables:', error);
            throw error;
      }
};

const insertDefaultData = async () => {
      try {
            // Check if admin exists
            const adminCheck = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);

            if (adminCheck.rows.length === 0) {
                  const bcrypt = require('bcryptjs');
                  const hashedPassword = await bcrypt.hash('admin123', 12);

                  await pool.query(
                        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
                        ['admin', 'admin@sekolah.com', hashedPassword, 'admin']
                  );
                  console.log('Default admin user created');
            }

            // Check if school info exists
            const schoolCheck = await pool.query('SELECT id FROM school_info LIMIT 1');

            if (schoolCheck.rows.length === 0) {
                  await pool.query(`
        INSERT INTO school_info (
          nama_sekolah, alamat, telepon, email, kepala_sekolah, 
          tahun_ajaran, tentang_sekolah, visi, misi
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
                        'SD Kebon Bawang 03',
                        'Jl. Pendidikan No. 123, Kota Contoh',
                        '021-12345678',
                        'info@sdcontoh.sch.id',
                        'Bapak/Ibu Kepala Sekolah',
                        '2023/2024',
                        'SD Kebon Bawang 03 adalah sekolah dasar yang berkomitmen memberikan pendidikan berkualitas.',
                        'Menjadi sekolah dasar terdepan dalam mencerdaskan bangsa.',
                        'Memberikan pendidikan berkualitas, Mengembangkan karakter siswa, Menciptakan lingkungan belajar yang nyaman'
                  ]);
                  console.log('Default school info created');
            }

            // Insert sample students
            const studentCheck = await pool.query('SELECT COUNT(*) FROM students');
            if (parseInt(studentCheck.rows[0].count) === 0) {
                  const students = [
                        ['Ahmad Budi Santoso', '1234567890', '6A', true, 85.50, 'Siswa berprestasi'],
                        ['Siti Fatimah', '1234567891', '6A', true, 78.25, 'Aktif dalam ekstrakurikuler'],
                        ['Muhammad Rizki', '1234567892', '6B', false, 65.75, 'Perlu perbaikan Matematika'],
                        ['Dewi Sartika', '1234567893', '6A', true, 92.00, 'Juara kelas'],
                        ['Bayu Pratama', '1234567894', '6B', true, 80.50, 'Baik dalam olahraga']
                  ];

                  for (const student of students) {
                        try {
                              await pool.query(
                                    'INSERT INTO students (nama, nisn, kelas, status_kelulusan, nilai_rata_rata, catatan) VALUES ($1, $2, $3, $4, $5, $6)',
                                    student
                              );
                        } catch (err) {
                              // Skip if duplicate NISN
                        }
                  }
                  console.log('Sample students created');
            }

            // Insert default news categories
            const categoryCheck = await pool.query('SELECT COUNT(*) FROM news_categories');
            if (parseInt(categoryCheck.rows[0].count) === 0) {
                  const categories = [
                        ['Pengumuman', 'pengumuman', 'Pengumuman resmi dari sekolah', '#dc3545'],
                        ['Kegiatan Sekolah', 'kegiatan-sekolah', 'Berita tentang kegiatan sekolah', '#28a745'],
                        ['Prestasi', 'prestasi', 'Prestasi siswa dan sekolah', '#ffc107'],
                        ['Akademik', 'akademik', 'Informasi akademik dan pembelajaran', '#007bff'],
                        ['Umum', 'umum', 'Berita umum sekolah', '#6c757d']
                  ];

                  for (const category of categories) {
                        try {
                              await pool.query(
                                    'INSERT INTO news_categories (name, slug, description, color) VALUES ($1, $2, $3, $4)',
                                    category
                              );
                        } catch (err) {
                              // Skip if duplicate
                        }
                  }
                  console.log('Default news categories created');
            }

            // Insert sample news
            const newsCheck = await pool.query('SELECT COUNT(*) FROM news');
            if (parseInt(newsCheck.rows[0].count) === 0) {
                  // Get admin user ID
                  const adminUser = await pool.query('SELECT id FROM users WHERE username = $1', ['admin']);
                  const adminId = adminUser.rows[0]?.id;

                  const sampleNews = [
                        [
                              'Selamat Datang Tahun Ajaran Baru 2024/2025',
                              'selamat-datang-tahun-ajaran-baru-2024-2025',
                              'Dengan penuh syukur dan kegembiraan, kami menyambut tahun ajaran baru 2024/2025. Tahun ini kami berkomitmen untuk memberikan pendidikan terbaik bagi seluruh siswa dengan berbagai program unggulan yang telah disiapkan.',
                              'Menyambut tahun ajaran baru dengan semangat dan optimisme tinggi.',
                              '/images/news/tahun-ajaran-baru.jpg',
                              adminId,
                              'Admin Sekolah',
                              'pengumuman',
                              ['tahun ajaran', 'pendidikan', 'sekolah'],
                              'published',
                              true,
                              150,
                              new Date()
                        ],
                        [
                              'Prestasi Gemilang dalam Olimpiade Sains Nasional',
                              'prestasi-gemilang-olimpiade-sains-nasional',
                              'Siswa-siswi SD Negeri Kebon Bawang 03 berhasil meraih prestasi membanggakan dalam Olimpiade Sains Nasional 2024. Lima siswa berhasil masuk dalam 10 besar nasional.',
                              'Pencapaian luar biasa siswa dalam kompetisi sains tingkat nasional.',
                              '/images/news/olimpiade-sains.jpg',
                              adminId,
                              'Admin Sekolah',
                              'prestasi',
                              ['olimpiade', 'sains', 'prestasi', 'nasional'],
                              'published',
                              true,
                              200,
                              new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
                        ],
                        [
                              'Kegiatan Bakti Sosial Bersama Masyarakat',
                              'kegiatan-bakti-sosial-bersama-masyarakat',
                              'Dalam rangka memperingati Hari Kemerdekaan Indonesia, seluruh warga sekolah mengadakan kegiatan bakti sosial di lingkungan sekitar sekolah.',
                              'Kegiatan peduli lingkungan sebagai wujud cinta tanah air.',
                              '/images/news/bakti-sosial.jpg',
                              adminId,
                              'Admin Sekolah',
                              'kegiatan-sekolah',
                              ['bakti sosial', 'masyarakat', 'kemerdekaan'],
                              'published',
                              false,
                              85,
                              new Date(Date.now() - 48 * 60 * 60 * 1000) // 2 days ago
                        ]
                  ];

                  for (const news of sampleNews) {
                        try {
                              await pool.query(`
                INSERT INTO news (
                  title, slug, content, excerpt, featured_image, 
                  author_id, author_name, category, tags, status, 
                  is_featured, view_count, published_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              `, news);
                        } catch (err) {
                              // Skip if duplicate slug
                        }
                  }
                  console.log('Sample news created');
            }

      } catch (error) {
            console.error('Error inserting default data:', error);
      }
};

// Function untuk migrasi manual jika diperlukan
export const runNewsMigration = async () => {
      try {
            console.log('Starting news migration...');
            
            // Create news table
            const createNewsTable = `
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        featured_image VARCHAR(500),
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        author_name VARCHAR(100),
        category VARCHAR(50) DEFAULT 'umum',
        tags TEXT[],
        status VARCHAR(20) DEFAULT 'draft',
        is_featured BOOLEAN DEFAULT false,
        view_count INTEGER DEFAULT 0,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

            // Create news categories table
            const createNewsCategoriesTable = `
      CREATE TABLE IF NOT EXISTS news_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        color VARCHAR(7) DEFAULT '#007bff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

            await pool.query(createNewsTable);
            await pool.query(createNewsCategoriesTable);
            
            console.log('News migration completed successfully!');
      } catch (error) {
            console.error('News migration failed:', error);
            throw error;
      }
};

export default pool;