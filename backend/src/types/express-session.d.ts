import 'express-session';
import type { Rol } from '../common/roles';

declare module 'express-session' {
  interface SessionData {
    usuarioId?: number;
    username?: string;
    rol?: Rol;
  }
}
