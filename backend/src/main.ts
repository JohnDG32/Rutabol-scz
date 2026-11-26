import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import express = require('express');
import session = require('express-session');
import connectPgSimple = require('connect-pg-simple');
import * as path from 'path';
import { AppModule } from './app.module';
import { DatabaseService } from './database/database.service';

async function bootstrap() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres');

  // rawBody permite verificar la firma del webhook de Stripe sobre los bytes originales.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const database = app.get(DatabaseService);
  await database.query('SELECT 1');

  // Con Caddy o con un túnel HTTPS, Express debe confiar en X-Forwarded-Proto
  // para reconocer la petición como segura y emitir la cookie con Secure.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Extra: fotografías de estudiantes servidas desde disco, no desde la BD.
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN || 'https://www.rutabol.test',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  const PgStore = connectPgSimple(session);
  const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax') as 'lax' | 'strict' | 'none';
  const secureRaw = process.env.COOKIE_SECURE;
  const secure: boolean | 'auto' =
    secureRaw === undefined || secureRaw === '' ? 'auto' : secureRaw === 'true';

  if (sameSite === 'none' && secure !== true) {
    throw new Error('COOKIE_SAMESITE=none requiere COOKIE_SECURE=true');
  }

  app.use(session({
    name: 'rutabol.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    store: new PgStore({
    pool: database.getPool(),
    createTableIfMissing: true
    }),
    // 'auto' conserva el comportamiento local con Caddy; en Ruta B se fuerza Secure.
    cookie: { httpOnly: true, sameSite, secure, maxAge: 60 * 60 * 1000 },
  }));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(Number(process.env.PORT) || 3001);
  console.log(`API RUTABOL-SCZ disponible en /api (origen permitido: ${process.env.FRONTEND_ORIGIN || 'https://www.rutabol.test'})`);
}
bootstrap().catch(err => { console.error(err); process.exit(1); });
