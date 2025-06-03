import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../types'
export const checkGraduation = async (req: Request, res: Response) => {
      try {
            const { search } = req.query;

            if (!search) {
                  return res.status(400).json({
                        success: false,
                        message: 'Parameter pencarian (nama atau NISN) harus diisi'
                  });
            }

            const searchTerm = search.toString().trim();

            // Search by name or NISN
            const studentResult = await query(`
      SELECT nama, nisn, kelas, status_kelulusan, nilai_rata_rata, catatan 
      FROM students 
      WHERE LOWER(nama) LIKE LOWER($1) OR nisn = $2
    `, [`%${searchTerm}%`, searchTerm]);

            if (studentResult.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Data siswa tidak ditemukan'
                  });
            }

            const students = studentResult.rows.map(student => ({
                  nama: student.nama,
                  nisn: student.nisn,
                  kelas: student.kelas,
                  status_kelulusan: student.status_kelulusan,
                  nilai_rata_rata: student.nilai_rata_rata,
                  catatan: student.catatan
            }));

            res.json({
                  success: true,
                  message: 'Data siswa ditemukan',
                  data: students
            });

      } catch (error) {
            console.error('Check graduation error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};

export const getAllStudents = async (req: AuthRequest, res: Response) => {
      try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const search = req.query.search as string || '';
            const offset = (page - 1) * limit;

            let whereClause = '';
            let params: any[] = [limit, offset];

            if (search) {
                  whereClause = 'WHERE LOWER(nama) LIKE LOWER($3) OR nisn LIKE $3';
                  params.push(`%${search}%`);
            }

            // Get total count
            const countQuery = `SELECT COUNT(*) FROM students ${whereClause}`;
            const countResult = await query(countQuery, search ? [`%${search}%`] : []);
            const totalCount = parseInt(countResult.rows[0].count);

            // Get students
            const studentsQuery = `
      SELECT id, nama, nisn, kelas, status_kelulusan, nilai_rata_rata, catatan, created_at
      FROM students 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;

            const studentsResult = await query(studentsQuery, params);

            const totalPages = Math.ceil(totalCount / limit);

            res.json({
                  success: true,
                  message: 'Data siswa berhasil diambil',
                  data: {
                        students: studentsResult.rows,
                        pagination: {
                              currentPage: page,
                              totalPages,
                              totalCount,
                              limit
                        }
                  }
            });

      } catch (error) {
            console.error('Get all students error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};

export const createStudent = async (req: AuthRequest, res: Response) => {
      try {
            const { nama, nisn, kelas, status_kelulusan, nilai_rata_rata, catatan } = req.body;

            if (!nama || !nisn) {
                  return res.status(400).json({
                        success: false,
                        message: 'Nama dan NISN harus diisi'
                  });
            }

            // Check if NISN already exists
            const existingStudent = await query('SELECT id FROM students WHERE nisn = $1', [nisn]);

            if (existingStudent.rows.length > 0) {
                  return res.status(400).json({
                        success: false,
                        message: 'NISN sudah terdaftar'
                  });
            }

            const result = await query(`
      INSERT INTO students (nama, nisn, kelas, status_kelulusan, nilai_rata_rata, catatan)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nama, nisn, kelas, status_kelulusan, nilai_rata_rata, catatan
    `, [nama, nisn, kelas || null, status_kelulusan || false, nilai_rata_rata || null, catatan || null]);

            res.status(201).json({
                  success: true,
                  message: 'Data siswa berhasil ditambahkan',
                  data: result.rows[0]
            });

      } catch (error) {
            console.error('Create student error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};

export const updateStudent = async (req: AuthRequest, res: Response) => {
      try {
            const { id } = req.params;
            const { nama, nisn, kelas, status_kelulusan, nilai_rata_rata, catatan } = req.body;

            if (!nama || !nisn) {
                  return res.status(400).json({
                        success: false,
                        message: 'Nama dan NISN harus diisi'
                  });
            }

            // Check if student exists
            const studentCheck = await query('SELECT id FROM students WHERE id = $1', [id]);

            if (studentCheck.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Data siswa tidak ditemukan'
                  });
            }

            // Check if NISN already exists for other students
            const existingStudent = await query('SELECT id FROM students WHERE nisn = $1 AND id != $2', [nisn, id]);

            if (existingStudent.rows.length > 0) {
                  return res.status(400).json({
                        success: false,
                        message: 'NISN sudah terdaftar untuk siswa lain'
                  });
            }

            const result = await query(`
      UPDATE students 
      SET nama = $1, nisn = $2, kelas = $3, status_kelulusan = $4, 
          nilai_rata_rata = $5, catatan = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING id, nama, nisn, kelas, status_kelulusan, nilai_rata_rata, catatan
    `, [nama, nisn, kelas || null, status_kelulusan || false, nilai_rata_rata || null, catatan || null, id]);

            res.json({
                  success: true,
                  message: 'Data siswa berhasil diperbarui',
                  data: result.rows[0]
            });

      } catch (error) {
            console.error('Update student error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};

export const deleteStudent = async (req: AuthRequest, res: Response) => {
      try {
            const { id } = req.params;

            // Check if student exists
            const studentCheck = await query('SELECT id FROM students WHERE id = $1', [id]);

            if (studentCheck.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Data siswa tidak ditemukan'
                  });
            }

            await query('DELETE FROM students WHERE id = $1', [id]);

            res.json({
                  success: true,
                  message: 'Data siswa berhasil dihapus'
            });

      } catch (error) {
            console.error('Delete student error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};

export const getGraduationStats = async (req: AuthRequest, res: Response) => {
      try {
            const statsQuery = `
      SELECT 
        COUNT(*) as total_siswa,
        SUM(CASE WHEN status_kelulusan = true THEN 1 ELSE 0 END) as lulus,
        SUM(CASE WHEN status_kelulusan = false THEN 1 ELSE 0 END) as tidak_lulus,
        ROUND(AVG(nilai_rata_rata), 2) as rata_rata_nilai
      FROM students
    `;

            const result = await query(statsQuery);
            const stats = result.rows[0];

            res.json({
                  success: true,
                  message: 'Statistik kelulusan berhasil diambil',
                  data: {
                        total_siswa: parseInt(stats.total_siswa),
                        lulus: parseInt(stats.lulus),
                        tidak_lulus: parseInt(stats.tidak_lulus),
                        rata_rata_nilai: parseFloat(stats.rata_rata_nilai) || 0,
                        persentase_lulus: stats.total_siswa > 0 ? Math.round((stats.lulus / stats.total_siswa) * 100) : 0
                  }
            });

      } catch (error) {
            console.error('Get graduation stats error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};