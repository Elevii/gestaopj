import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀🚀🚀 STARTING NESTJS APPLICATION - VERSION 2.0 🚀🚀🚀');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    
    // Validar variáveis críticas antes de iniciar
    const port = process.env.PORT || 3001;
    console.log('PORT:', port);
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não está definida nas variáveis de ambiente');
    }
    console.log('✅ DATABASE_URL está configurada');
    
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET não está definida nas variáveis de ambiente');
    }
    console.log('✅ JWT_SECRET está configurada');
    
    console.log('Creating NestJS application...');
    const app = await NestFactory.create(AppModule);
    
    // Habilitar CORS
    const frontendUrl = process.env.FRONTEND_URL;
    console.log('FRONTEND_URL:', frontendUrl || 'not set (CORS enabled for all origins)');
    app.enableCors({
      origin: frontendUrl 
        ? [frontendUrl, 'http://localhost:3000'] 
        : true, // Em desenvolvimento, aceitar qualquer origem
      credentials: true,
    });
    
    // Habilitar validação global
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    console.log('Starting server...');
    await app.listen(port, '0.0.0.0');
    console.log(`✅✅✅ Application is running on: http://0.0.0.0:${port}`);
    console.log(`✅✅✅ Listening on all network interfaces (0.0.0.0)`);
    console.log(`✅✅✅ Health check available at: http://0.0.0.0:${port}/health`);
  } catch (error) {
    console.error('❌❌❌ FATAL ERROR starting application ❌❌❌');
    console.error('Error type:', error?.constructor?.name || typeof error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Error object:', JSON.stringify(error, null, 2));
    }
    process.exit(1);
  }
}
bootstrap();
