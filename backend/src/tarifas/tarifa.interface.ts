import type { CategoriaTarifa } from '../common/roles';

export interface Tarifa {
  id: number;
  lineaId: number;
  categoria: CategoriaTarifa;
  monto: number;
  vigenteDesde: string;
  activa: boolean;
}
