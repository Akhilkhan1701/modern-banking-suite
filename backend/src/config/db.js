const mongoose=require('mongoose');

function connectToDB(){
    mongoose.connect(process.env.MONGO_URI).then(()=>{
        console.log("Connected to MongoDB successfully");
    })
    .catch(err=>{
        console.error("Critical: Error connecting to MongoDB", err.message);
        process.exit(1);
    })
}

module.exports=connectToDB;