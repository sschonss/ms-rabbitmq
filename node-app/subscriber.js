const amqp = require('amqplib');

async function connectWithRetry() {
  const maxRetries = 5;  
  const retryDelay = 5000; 

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connection = await amqp.connect('amqp://rabbitmq');
      return connection;
    } catch (err) {
      console.error(`Not possible to connect to RabbitMQ. Retrying in ${retryDelay}ms. Attempt ${attempt} of ${maxRetries}.`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts`);
}

async function receiveMessages() {
  try {
    const connection = await connectWithRetry();
    const channel = await connection.createChannel();

    const queue = 'hello';
    await channel.assertQueue(queue, { durable: false });

    console.log(" [*] Waiting for messages in %s.", queue);
    channel.consume(queue, function(msg) {
      console.log(" [x] Received: %s", msg.content.toString());
    }, {
        noAck: true
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

receiveMessages();