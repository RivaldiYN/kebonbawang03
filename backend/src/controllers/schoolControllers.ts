import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../types';

export const getSchoolInfo = async (req: Request, res: Response) => {
      try {
            const result = await query('SELECT * FROM school_info ORDER BY id DESC LIMIT 1');

            if (result.rows.length === 0) {
                  return res.status(404).json({
                        success: false,
                        message: 'Informasi sekolah tidak ditemukan'
                  });
            }

            res.json({
                  success: true,
                  message: 'Informasi sekolah berhasil diambil',
                  data: result.rows[0]
            });

      } catch (error) {
            console.error('Get school info error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};

export const updateSchoolInfo = async (req: AuthRequest, res: Response) => {
      try {
            const {
                  nama_sekolah,
                  alamat,
                  telepon,
                  email,
                  kepala_sekolah,
                  tahun_ajaran,
                  tentang_sekolah,
                  visi,
                  misi,
                  logo_url
            } = req.body;

            if (!nama_sekolah) {
                  return res.status(400).json({
                        success: false,
                        message: 'Nama sekolah harus diisi'
                  });
            }

            // Check if record exists
            const existingRecord = await query('SELECT id FROM school_info ORDER BY id DESC LIMIT 1');

            let result;
            if (existingRecord.rows.length === 0) {
                  // Insert new record
                  result = await query(`
        INSERT INTO school_info (
          nama_sekolah, alamat, telepon, email, kepala_sekolah, 
          tahun_ajaran, tentang_sekolah, visi, misi, logo_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
                        nama_sekolah, alamat, telepon, email, kepala_sekolah,
                        tahun_ajaran, tentang_sekolah, visi, misi, logo_url
                  ]);
            } else {
                  // Update existing record
                  const recordId = existingRecord.rows[0].id;
                  result = await query(`
        UPDATE school_info 
        SET nama_sekolah = $1, alamat = $2, telepon = $3, email = $4, 
            kepala_sekolah = $5, tahun_ajaran = $6, tentang_sekolah = $7, 
            visi = $8, misi = $9, logo_url = $10, updated_at = CURRENT_TIMESTAMP
        WHERE id = $11
        RETURNING *
      `, [
                        nama_sekolah, alamat, telepon, email, kepala_sekolah,
                        tahun_ajaran, tentang_sekolah, visi, misi, logo_url, recordId
                  ]);
            }

            res.json({
                  success: true,
                  message: 'Informasi sekolah berhasil diperbarui',
                  data: result.rows[0]
            });

      } catch (error) {
            console.error('Update school info error:', error);
            res.status(500).json({
                  success: false,
                  message: 'Terjadi kesalahan pada server'
            });
      }
};