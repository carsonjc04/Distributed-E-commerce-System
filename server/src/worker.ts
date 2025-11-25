import { ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from 'uuid';
import { sqsClient } from "./config/aws.config";
import { dynamoClient } from "./config/dynamo";
import { getQueueUrl } from "./services/sqs.service";
import { ensureTableExists } from "./services/db-init.service";

const processMessages = async () => {
    console.log("Worker started. Initializing DB...");
    await ensureTableExists();
    console.log("Worker polling for messages...");

    const queueUrl = await getQueueUrl();

    while (true) {
        try {
            const command = new ReceiveMessageCommand({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 20,
            });

            const response = await sqsClient.send(command);

            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    console.log(`Processing Order: ${message.Body}`);

                    if (message.Body) {
                        const body = JSON.parse(message.Body);

                        // Save to DynamoDB
                        const orderId = uuidv4();
                        const putCommand = new PutItemCommand({
                            TableName: "Orders",
                            Item: {
                                orderId: { S: orderId },
                                userId: { S: body.userId },
                                productId: { S: body.productId },
                                status: { S: "CONFIRMED" },
                                timestamp: { S: new Date().toISOString() }
                            }
                        });

                        await dynamoClient.send(putCommand);
                        console.log("Order Saved to DB");
                    }

                    // Delete message after processing
                    const deleteCommand = new DeleteMessageCommand({
                        QueueUrl: queueUrl,
                        ReceiptHandle: message.ReceiptHandle,
                    });
                    await sqsClient.send(deleteCommand);
                }
            }
        } catch (error) {
            console.error("Error processing message:", error);
            // Wait a bit before retrying on error to avoid tight loop
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

processMessages();
