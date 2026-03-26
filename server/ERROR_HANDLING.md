# Server Error Handling & Logging Improvements

This document outlines the comprehensive error handling and logging system implemented for the report creator server.

## 🚀 Features Added

### 1. Enhanced Logging System

- **Structured logging** with timestamps and context labels
- **Different log levels**: INFO, ERROR, WARN, SUCCESS
- **Consistent format** across all server components
- **Error details** including stack traces for debugging

### 2. Centralized Error Handling

- **Custom error classes** for different error types
- **Async error wrapper** for route handlers
- **Global error middleware** for consistent error responses
- **Prisma error handling** with specific error codes

### 3. Server Startup Improvements

- **Environment validation** with clear error messages
- **Database connection testing** before server starts
- **Graceful shutdown** handling for SIGTERM/SIGINT
- **Port conflict detection** and reporting

### 4. Health Monitoring

- **Health check endpoint** (`/health`) for monitoring
- **System info endpoint** (`/info`) for debugging
- **Database connectivity** status checking
- **Memory usage** monitoring

## 📁 Files Modified/Created

### New Files

- `server/utils/errorHandler.js` - Centralized error handling utilities
- `server/routes/healthRoutes.js` - Health check endpoints
- `server/test-error-handling.js` - Error handling test script

### Modified Files

- `server/index.js` - Main server with enhanced error handling
- `server/controllers/templateController.js` - Template operations with logging
- `server/controllers/pdfController.js` - PDF generation with error handling
- `server/routes/templateRoutes.js` - Async error wrapping
- `server/routes/pdfRoutes.js` - Async error wrapping

## 🔧 Usage

### Starting the Server

```bash
cd server
npm start
```

### Health Check

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed system info
curl http://localhost:3000/info
```

### Testing Error Handling

```bash
# Run the test script
node test-error-handling.js
```

## 📊 Log Format

All logs follow this format:

```
[TAG] YYYY-MM-DDTHH:mm:ss.sssZ - Message
```

### Log Tags

- `[INFO]` - General information
- `[ERROR]` - Error occurrences
- `[WARN]` - Warning messages
- `[SUCCESS]` - Successful operations
- `[TEMPLATE]` - Template operations
- `[PDF]` - PDF generation operations
- `[ERROR_HANDLER]` - Error handling system

## 🛡️ Error Types

### Custom Error Classes

- `AppError` - Base application error
- `ValidationError` - Input validation errors (400)
- `NotFoundError` - Resource not found errors (404)
- `DatabaseError` - Database operation errors (500)

### Prisma Error Handling

- `P2002` - Unique constraint violation (409)
- `P2025` - Record not found (404)
- `P2003` - Foreign key constraint violation (400)
- `P2014` - Invalid relation (400)

## 🔍 Monitoring

### Health Check Response

```json
{
    "uptime": 123.456,
    "message": "OK",
    "timestamp": 1234567890,
    "environment": "development",
    "memory": {
        "rss": 50331648,
        "heapTotal": 20971520,
        "heapUsed": 15728640,
        "external": 1048576
    },
    "database": "connected",
    "version": "v18.17.0"
}
```

### System Info Response

```json
{
  "server": {
    "nodeVersion": "v18.17.0",
    "platform": "win32",
    "arch": "x64",
    "uptime": 123.456,
    "memory": {...},
    "pid": 12345
  },
  "environment": {
    "NODE_ENV": "development",
    "PORT": 3000,
    "CLIENT_URL": "http://localhost:5173"
  },
  "timestamp": "2023-12-07T10:30:00.000Z"
}
```

## 🚨 Error Response Format

### Development Environment

```json
{
  "status": "error",
  "error": {...},
  "message": "Detailed error message",
  "stack": "Error stack trace"
}
```

### Production Environment

```json
{
    "status": "error",
    "message": "Something went wrong!"
}
```

## 🔧 Configuration

### Environment Variables

- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (default: 3000)
- `CLIENT_URL` - Frontend URL (default: http://localhost:5173)
- `DATABASE_URL` - Database connection string (required)

## 📝 Best Practices

1. **Always use asyncHandler** for route handlers
2. **Log important operations** with appropriate log levels
3. **Use custom error classes** for specific error types
4. **Test error scenarios** regularly
5. **Monitor health endpoints** in production
6. **Check logs** for debugging issues

## 🔄 Graceful Shutdown

The server handles graceful shutdown properly:

- Closes HTTP server connections
- Logs shutdown process
- Forces exit after 10 seconds if needed
- Handles SIGTERM and SIGINT signals

## 🧪 Testing

Run the error handling test script:

```bash
node test-error-handling.js
```

This will test:

- Health check endpoint
- 404 error handling
- Error response format
- Server connectivity

## 📈 Performance Considerations

- Request logging middleware adds minimal overhead
- Error handling is optimized for production
- Memory usage is monitored and logged
- Database connection testing is done once at startup

## 🚀 Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Configure proper logging destinations
3. Set up monitoring for health endpoints
4. Configure reverse proxy (nginx/Apache)
5. Set up process manager (PM2/systemd)
6. Configure log rotation
7. Set up alerts for error rates
