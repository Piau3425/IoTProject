import socketio

# Create Socket.IO client
sio = socketio.Client(logger=True, engineio_logger=True)

@sio.on('connect')
def on_connect():
    print('✅ Connected to server!')
    print(f'Socket ID: {sio.sid}')

@sio.on('disconnect')
def on_disconnect():
    print('❌ Disconnected from server')

@sio.on('system_state')
def on_system_state(data):
    print('📡 Received system_state event')

@sio.on('hardware_status')
def on_hardware_status(data):
    print('🔧 Received hardware_status event')

try:
    print('Connecting to http://localhost:8000...')
    sio.connect('http://localhost:8000', socketio_path='/socket.io/')
    print('Waiting for events...')
    sio.wait()
except Exception as e:
    print(f'❌ Connection failed: {e}')
