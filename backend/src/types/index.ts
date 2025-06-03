//backend/src/config/database.ts
import { Request } from 'express';
type MulterFile = Express.Multer.File;

export interface JWTPayload {
      id: number;
      username: string;
      email: string;
      iat?: number;
      exp?: number;
}

export interface AuthRequest extends Request {
      user?: JWTPayload;
      file?: MulterFile;
      files?: MulterFile[] | { [fieldname: string]: MulterFile[] };
}

export interface FileUploadRequest extends Request {
      file?: MulterFile;
      files?: MulterFile[] | { [fieldname: string]: MulterFile[] };
}

export interface Student {
      id?: number;
      nama: string;
      nisn: string;
      kelas?: string;
      status_kelulusan: boolean;
      nilai_rata_rata?: number;
      catatan?: string;
      created_at?: Date;
      updated_at?: Date;
}

export interface User {
      id?: number;
      username: string;
      email: string;
      password: string;
      role: string;
      created_at?: Date;
      updated_at?: Date;
}

export interface SchoolInfo {
      id?: number;
      nama_sekolah: string;
      alamat?: string;
      telepon?: string;
      email?: string;
      kepala_sekolah?: string;
      tahun_ajaran?: string;
      tentang_sekolah?: string;
      visi?: string;
      misi?: string;
      logo_url?: string;
      created_at?: Date;
      updated_at?: Date;
}

export interface News {
      id?: number;
      judul: string;
      slug: string;
      gambar_url?: string;
      isi_content: string;
      excerpt?: string;
      status: 'draft' | 'published' | 'archived';
      tanggal_rilis?: Date;
      dibuat_oleh: number;
      admin_name?: string;
      views: number;
      tags?: string[];
      kategori?: string;
      featured: boolean;
      created_at?: Date;
      updated_at?: Date;
}

export interface NewsCategory {
      id?: number;
      nama_kategori: string;
      slug: string;
      deskripsi?: string;
      color?: string;
      created_at?: Date;
}

export interface NewsImage {
      id?: number;
      news_id: number;
      image_url: string;
      image_alt?: string;
      image_caption?: string;
      is_featured: boolean;
      created_at?: Date;
}

export interface ApiResponse<T = any> {
      success: boolean;
      message: string;
      data?: T;
}

export interface PaginationInfo {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
}

export interface GraduationStats {
      total_siswa: number;
      lulus: number;
      tidak_lulus: number;
      rata_rata_nilai: number;
      persentase_lulus: number;
}

export interface NewsStats {
      total_news: number;
      published: number;
      draft: number;
      archived: number;
      total_views: number;
      most_viewed: News[];
      recent_news: News[];
}

export interface FileUpload {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      filename: string;
      path: string;
}

export interface NewsFilter {
      kategori?: string;
      status?: 'draft' | 'published' | 'archived';
      author?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      featured?: boolean;
      page?: number;
      limit?: number;
      sortBy?: 'created_at' | 'tanggal_rilis' | 'views' | 'judul';
      sortOrder?: 'ASC' | 'DESC';
}