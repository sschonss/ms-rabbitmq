<?php
require_once __DIR__ . '/vendor/autoload.php';
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;

$maxRetries = 5; 
$retryDelay = 5; 

for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
    try {
        $connection = new AMQPStreamConnection('rabbitmq', 5672, 'guest', 'guest');
        $channel = $connection->channel();
        break;
    } catch (Exception $e) {
        echo "Failed to connect to RabbitMQ. Retrying in $retryDelay seconds...\n";
        sleep($retryDelay);
    }
}

if (!isset($connection)) {
    echo "Not possible to connect to RabbitMQ. Exiting...\n The application will be restarted by Docker\n";
    exit(1);
}

$channel->queue_declare('hello', false, false, false, false);

$msg = new AMQPMessage('Hello, RabbitMQ! Now is ' . date('Y-m-d H:i:s'));
$channel->basic_publish($msg, '', 'hello');

echo " [x] Sent 'Hello, RabbitMQ!'\n";

$channel->close();
$connection->close();