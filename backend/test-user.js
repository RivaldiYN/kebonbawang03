const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'school',
  password: '123',
  port: 5432,
});

async function testUser() {
  try {
    // Cek user admin
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Admin user TIDAK ADA! Creating...');
      
      // Buat user admin
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await pool.query(
        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
        ['admin', 'admin@sekolah.com', hashedPassword, 'admin']
      );
      console.log('✅ Admin user created');
    } else {
      console.log('✅ Admin user found');
      
      // Test password
      const isValid = await bcrypt.compare('admin123', userResult.rows[0].password);
      console.log('🔑 Password test:', isValid);
      
      if (!isValid) {
        console.log('🔄 Fixing password...');
        const newHash = await bcrypt.hash('admin123', 12);
        await pool.query('UPDATE users SET password = $1 WHERE username = $2', [newHash, 'admin']);
        console.log('✅ Password fixed');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('💥 Error:', error);
    process.exit(1);
  }
}

testUser();