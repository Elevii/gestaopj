import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('Starting NestJS application...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('PORT:', process.env.PORT || '3001');
    
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
    
    const port = process.env.PORT || 3001;
    await app.listen(port, '0.0.0.0');
    console.log(`✅ Application is running on: http://0.0.0.0:${port}`);
    console.log(`✅ Listening on all network interfaces (0.0.0.0)`);
  } catch (error) {
    console.error('❌ Error starting application:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}
bootstrap();
