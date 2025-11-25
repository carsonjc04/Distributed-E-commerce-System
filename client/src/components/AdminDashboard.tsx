import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import '../App.css';

const socket = io('http://localhost:3000');

export default function AdminDashboard() {
    const [stock, setStock] = useState<number | null>(null);
    const [flash, setFlash] = useState(false);
    const [restockAmount, setRestockAmount] = useState(50);

    useEffect(() => {
        socket.on('connect', () => {
            console.log('Connected to WebSocket');
        });

        socket.on('inventory_update', (data: { productId: string; stock: number }) => {
            console.log('Inventory Update:', data);
            setStock(data.stock);

            // Flash effect
            setFlash(true);
            setTimeout(() => setFlash(false), 200);
        });

        return () => {
            socket.off('connect');
            socket.off('inventory_update');
        };
    }, []);

    const handleRestock = async () => {
        try {
            await axios.post('/api/restock', { productId: 'item-123', amount: restockAmount });
            alert('Restock Command Sent');
        } catch (error) {
            console.error('Restock failed', error);
            alert('Restock Failed');
        }
    };

    return (
        <div className="container">
            <h1>🛡️ Admin Dashboard</h1>

            <div className={`card ${flash ? 'flash-red' : ''}`} style={{ transition: 'background 0.2s' }}>
                <h2>Live Inventory</h2>
                <div className="stock-display" style={{ justifyContent: 'center' }}>
                    <span className="count" style={{ fontSize: '6rem' }}>
                        {stock !== null ? stock : '...'}
                    </span>
                </div>
                <p>Real-time updates via WebSocket</p>
            </div>

            <div className="card" style={{ marginTop: '2rem', background: '#222' }}>
                <h2>Ops Controls</h2>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <input
                        type="number"
                        value={restockAmount}
                        onChange={(e) => setRestockAmount(Number(e.target.value))}
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #444', background: '#333', color: 'white' }}
                    />
                    <button onClick={handleRestock} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
                        Restock Inventory
                    </button>
                </div>
            </div>
        </div>
    );
}
