export type CategoriaEstudiante = 'ESCOLAR' | 'UNIVERSITARIO';

export interface Estudiante {
  id: number;
  usuarioId: number | null;
  nombre: string;
  apellido: string;
  ci: string;
  categoria: CategoriaEstudiante;
  codigo: string;
  correoInstitucional: string | null;
  fotoUrl: string;
  verificado: boolean;
  creadoEn: string;
}
