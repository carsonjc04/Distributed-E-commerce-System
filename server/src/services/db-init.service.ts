import { CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { dynamoClient } from "../config/dynamo";

export const ensureTableExists = async () => {
    try {
        const command = new CreateTableCommand({
            TableName: "Orders",
            KeySchema: [{ AttributeName: "orderId", KeyType: "HASH" }],
            AttributeDefinitions: [{ AttributeName: "orderId", AttributeType: "S" }],
            BillingMode: "PAY_PER_REQUEST",
        });

        await dynamoClient.send(command);
        console.log("Table Orders Created");
    } catch (error: any) {
        if (error.name === "ResourceInUseException") {
            console.log("Table Orders already exists");
        } else {
            console.error("Error creating table:", error);
            throw error;
        }
    }
};
