const logger = {
    info: (message, ...args) => {
        console.log(`[ERROR_HANDLER] ${new Date().toISOString()} - ${message}`, ...args);
    },
    error: (message, error) => {
        console.error(`[ERROR_HANDLER] ${new Date().toISOString()} - ${message}`);
        if (error) {
            console.error('Error details:', error.message || error);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }
    },
    warn: (message, ...args) => {
        console.warn(`[ERROR_HANDLER] ${new Date().toISOString()} - ${message}`, ...args);
    }
};

class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

class DatabaseError extends AppError {
    constructor(message) {
        super(`Database error: ${message}`, 500);
    }
}

const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            const message = error.details.map((detail) => detail.message).join(', ');
            logger.warn(`Validation error: ${message}`);
            return next(new ValidationError(message));
        }
        next();
    };
};

const handlePrismaError = (error) => {
    logger.error('Prisma error:', error);

    switch (error.code) {
        case 'P2002':
            return new AppError('Unique constraint violation', 409);
        case 'P2025':
            return new NotFoundError('Record');
        case 'P2003':
            return new AppError('Foreign key constraint violation', 400);
        case 'P2014':
            return new AppError('Invalid relation', 400);
        default:
            return new DatabaseError(error.message);
    }
};

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

const sendErrorProd = (err, res) => {
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    } else {
        logger.error('Programming error:', err);
        res.status(500).json({
            status: 'error',
            message: 'Something went wrong!'
        });
    }
};

const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (err.code && err.code.startsWith('P')) {
        err = handlePrismaError(err);
    }

    if (err.name === 'ValidationError') {
        err = new ValidationError(err.message);
    }

    if (err.name === 'JsonWebTokenError') {
        err = new AppError('Invalid token', 401);
    }

    if (err.name === 'TokenExpiredError') {
        err = new AppError('Token expired', 401);
    }

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        sendErrorProd(err, res);
    }
};

const notFound = (req, res, next) => {
    const err = new NotFoundError(`Route ${req.originalUrl}`);
    next(err);
};

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    DatabaseError,
    asyncHandler,
    validateRequest,
    globalErrorHandler,
    notFound,
    logger
};
