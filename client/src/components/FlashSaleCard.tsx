import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import type { RootState, AppDispatch } from '../store/store';
import { purchaseItem, setStock } from '../store/features/productSlice';
import '../App.css';

export default function FlashSaleCard() {
    const { stock, status, error } = useSelector((state: RootState) => state.product);
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        const socket = io('http://localhost:3000');

        socket.on('inventory_update', (data: { productId: string; stock: number }) => {
            dispatch(setStock(data.stock));
        });

        return () => {
            socket.disconnect();
        };
    }, [dispatch]);

    const handleBuy = () => {
        if (stock > 0 && status !== 'loading') {
            dispatch(purchaseItem('item-123'));
        }
    };

    return (
        <div className="container">
            <h1>⚡ Velocity Flash Sale</h1>

            <div className="card">
                <div className="product-image">
                    <span style={{ fontSize: '4rem' }}>🚀</span>
                </div>
                <h2>Limited Edition RTX 5090</h2>

                <div className="stock-display">
                    <span className="label">Remaining Stock:</span>
                    <span className={`count ${stock === 0 ? 'out-of-stock' : ''}`}>
                        {stock}
                    </span>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button
                    onClick={handleBuy}
                    disabled={stock === 0 || status === 'loading'}
                    className={stock === 0 ? 'disabled' : ''}
                >
                    {stock === 0 ? 'SOLD OUT' : status === 'loading' ? 'Processing...' : 'BUY NOW'}
                </button>
            </div>

            <Link to="/admin" style={{ color: '#666', marginTop: '2rem' }}>Go to Admin Dashboard</Link>
        </div>
    );
}
