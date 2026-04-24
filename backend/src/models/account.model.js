/**
 * Account Model
 * Represents a user's bank account. Tracks status, currency, and cached balance.
 */
const mongoose=require("mongoose")
const ledgerModel=require("./ledger.model")

const accountSchema=new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:[true,"Account must belong to a user"],
        index:true
    },
    status:{
        type:String,
        enum:{
            values:["PENDING_APPROVAL","Active","FROZEN","CLOSED","REJECTED"],
            message:"Invalid account status",
        },
        default:"PENDING_APPROVAL"
    },
    currency:{
        type:String,
        required:[true,"Currency is required for creating an account"],
        default:"INR"
    },
    systemUser:{
        type:Boolean,
        default:false,
        select:false
    },
    approvalNote: {
        type: String,
        default: ""
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    }
},{
    timestamps:true
})

// Optimize queries for user accounts
accountSchema.index({user:1,status:1})

/**
 * Calculates the actual balance of the account by aggregating all ledger entries.
 * This is the source of truth for account balances.
 */
accountSchema.methods.getBalance=async function(){
    const balaceData=await ledgerModel.aggregate([
        {$match:{account:this._id}},
        {
            $group:{
                _id:"$account",
                totalDebit:{$sum:{$cond:[{$eq:["$type","DEBIT"]},"$amount",0]}},
                totalCredit:{$sum:{$cond:[{$eq:["$type","CREDIT"]},"$amount",0]}}
            }
        },
        {
            $project:{
                _id:0,
                balance:{$subtract:["$totalCredit","$totalDebit"]}
            }
        }

    ])
    if(balaceData.length===0){
        return 0
    }
    return balaceData[0].balance
}




const accountModel=mongoose.model("account",accountSchema)

module.exports=accountModel