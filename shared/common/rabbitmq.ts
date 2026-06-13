import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import config from '../config';
import logger from './logger';

export type MessageHandler = (msg: any) => Promise<void>;

class RabbitMQClient {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private static instance: RabbitMQClient;

  private constructor() {}

  public static getInstance(): RabbitMQClient {
    if (!RabbitMQClient.instance) {
      RabbitMQClient.instance = new RabbitMQClient();
    }
    return RabbitMQClient.instance;
  }

  public async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', err);
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
      });

      logger.info('RabbitMQ connected');
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', error);
      throw error;
    }
  }

  public async assertExchange(
    name: string,
    type: 'direct' | 'fanout' | 'topic' | 'headers',
    options?: any
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    await this.channel.assertExchange(name, type, options);
  }

  public async assertQueue(
    name: string,
    options?: any
  ): Promise<{ queue: string; messageCount: number; consumerCount: number }> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    return await this.channel.assertQueue(name, options);
  }

  public async bindQueue(
    queue: string,
    exchange: string,
    routingKey: string
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    await this.channel.bindQueue(queue, exchange, routingKey);
  }

  public async publish(
    exchange: string,
    routingKey: string,
    message: any,
    options?: any
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    
    const content = Buffer.from(JSON.stringify(message));
    return this.channel.publish(exchange, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
      ...options,
    });
  }

  public async consume(
    queue: string,
    handler: MessageHandler,
    options?: any
  ): Promise<string> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const { consumerTag } = await this.channel.consume(
      queue,
      async (msg: ConsumeMessage | null) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await handler(content);
            this.channel?.ack(msg);
          } catch (error) {
            logger.error('Error processing message', error);
            this.channel?.nack(msg, false, false);
          }
        }
      },
      options
    );

    return consumerTag;
  }

  public async ack(msg: ConsumeMessage): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    this.channel.ack(msg);
  }

  public async nack(msg: ConsumeMessage, allUpTo?: boolean): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    this.channel.nack(msg, allUpTo);
  }

  public async sendToQueue(
    queue: string,
    message: any,
    options?: any
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    
    const content = Buffer.from(JSON.stringify(message));
    return this.channel.sendToQueue(queue, content, {
      persistent: true,
      contentType: 'application/json',
      ...options,
    });
  }

  public async getChannel(): Promise<Channel> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    return this.channel;
  }

  public async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection', error);
    }
  }
}

const rabbitMQ = RabbitMQClient.getInstance();

export default rabbitMQ;
export { RabbitMQClient };
