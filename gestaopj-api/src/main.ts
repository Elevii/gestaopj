import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    
    // Habilitar CORS
    const frontendUrl = process.env.FRONTEND_URL;
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
    console.log(`Application is running on: http://0.0.0.0:${port}`);
  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
}
bootstrap();
