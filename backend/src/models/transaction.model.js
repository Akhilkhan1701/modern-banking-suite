const mongoose=require("mongoose")


const transactionSchema=new mongoose.Schema({
    fromAccount:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"account",
        required:[true,"Transaction must be axxociatedwith a from account"],
        index:true
    },
    toAccount:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"account",
        required:[true,"Transaction must be associated with a to account"],
        index:true
    },
    status:{
        type:String,
        enum:{
            values:["PENDING","COMPLETED","FAILED","CANCELLED"],
            message:"Status must be either PENDING, COMPLETED, FAILED or CANCELLED"
        },
        default:"PENDING"
    },
    amount:{
        type:Number,
        required:[true,"Amount is required for a transaction"],
        min:[0.0,"Amount cannot be negative"],
    },
    idempotencyKey:{
        type:String,
        required:[true,"Idempotency key is required for a transaction"],
        unique:true,
        index:true
    }
},{
    timestamps:true
})

transactionSchema.index({ fromAccount: 1, createdAt: -1 })
transactionSchema.index({ toAccount: 1, createdAt: -1 })


const transactionModel=mongoose.model("transaction",transactionSchema)

module.exports=transactionModel