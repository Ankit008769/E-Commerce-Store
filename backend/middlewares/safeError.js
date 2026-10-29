export function safeError(error,req,res,next){
 if(res.headersSent)return next(error);
 let status=error.status||error.statusCode||500;
 if(error.name==='MulterError'||error.name==='ValidationError'||error.name==='CastError')status=400;
 if(error.code===11000)status=409;
 if(!Number.isInteger(status)||status<400||status>599)status=500;
 const message=status>=500?'Something went wrong. Please try again.':error.code===11000?'This record already exists.':['ValidationError','CastError'].includes(error.name)?'Invalid request data.':error.name==='MulterError'?'Invalid upload or upload limit exceeded.':error.type==='entity.parse.failed'?'Invalid JSON request.':error.type==='entity.too.large'?'Request is too large.':error.message;
 res.status(status).json({message});
}
