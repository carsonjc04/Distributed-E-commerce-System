import { CreateQueueCommand, GetQueueUrlCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "../config/aws.config";

const QUEUE_NAME = "orders-queue";

export const getQueueUrl = async (): Promise<string> => {
    try {
        const command = new GetQueueUrlCommand({ QueueName: QUEUE_NAME });
        const response = await sqsClient.send(command);
        return response.QueueUrl!;
    } catch (error: any) {
        if (error.name === "QueueDoesNotExist") {
            const command = new CreateQueueCommand({ QueueName: QUEUE_NAME });
            const response = await sqsClient.send(command);
            return response.QueueUrl!;
        }
        throw error;
    }
};

export const sendMessage = async (body: any) => {
    try {
        const queueUrl = await getQueueUrl();
        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(body),
        });
        await sqsClient.send(command);
        console.log(`Message sent to SQS: ${JSON.stringify(body)}`);
    } catch (error) {
        console.error("Error sending message to SQS:", error);
        throw error;
    }
};
