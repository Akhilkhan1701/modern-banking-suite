/**
 * Database Configuration
 * Handles the connection to MongoDB using Mongoose.
 */
const mongoose=require('mongoose');

/**
 * Connects to the MongoDB database using the URI from environment variables.
 */
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