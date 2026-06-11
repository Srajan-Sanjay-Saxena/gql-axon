import { GraphQLError } from 'graphql';

type AppErrorExtensions = {
  code: string;
  http: { status: number };
  devDetails?: {
    errorName?: string;
    rawMessage?: string;
    stack?: string;
    prismaCode?: string;
  };
};

export class AppError extends GraphQLError {
  public isOperational: boolean;
  public override readonly extensions: AppErrorExtensions;

  public constructor(
    message: string, 
    code: string, 
    httpStatus: number, 
    isOperational: boolean = true, 
    rawError?: any
  ) {

    const isDev = process.env.NODE_ENV === 'development';
    const extensions = {
      code,
      http: { status: httpStatus },
      
      ...(isDev && { 
        devDetails: {
          errorName: rawError?.name,
          rawMessage: rawError?.message,
          stack: rawError?.stack,
          prismaCode: rawError?.code 
        }
      })
    };

    // PROD MODE: Hide non-operational messages
    // If it's a random bug in prod, hide the message from the client.
    const finalMessage = (!isDev && !isOperational) 
      ? 'Something went very wrong! Please try again later.' 
      : message;

    super(finalMessage, { extensions });
    
    this.extensions = extensions;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
  }
}