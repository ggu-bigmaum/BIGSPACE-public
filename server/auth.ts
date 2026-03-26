import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import type { Express, Request, Response, NextFunction } from "express";

// ── Passport 설정 ──────────────────────────────────────────────────────

export function setupAuth(app: Express) {
  // 세션 스토어 (PostgreSQL)
  const PgStore = connectPgSimple(session);

  app.use(
    session({
      store: new PgStore({
        pool: pool as any,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "bigspace-dev-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24시간
        httpOnly: true,
        secure: process.env.FORCE_HTTPS === "true",
        sameSite: "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy — GS 인증 1-1: 오류 메시지 단일화
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          // 1-1: 어떤 필드가 틀렸는지 알려주지 않음
          return done(null, false, { message: "아이디 또는 비밀번호가 올바르지 않습니다." });
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "아이디 또는 비밀번호가 올바르지 않습니다." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });
}

// ── 비밀번호 해싱 (GS 인증 1-2: bcrypt + salt) ────────────────────────

export async function hashPassword(plainPassword: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(plainPassword, saltRounds);
}

// ── 인증 미들웨어 (GS 인증 1-3, 1-6) ─────────────────────────────────

/** 로그인 필수 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "로그인이 필요합니다." });
}

/** admin 역할 필수 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = req.user as any;
    if (user?.role === "admin") {
      return next();
    }
    return res.status(403).json({ message: "관리자 권한이 필요합니다." });
  }
  return res.status(401).json({ message: "로그인이 필요합니다." });
}
