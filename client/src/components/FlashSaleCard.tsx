import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import type { RootState, AppDispatch } from '../store/store';
import { purchaseItem, setStock } from '../store/features/productSlice';
import '../App.css';

const PRODUCT_ID = 'item-123';

export default function FlashSaleCard() {
    const { stock, status, error } = useSelector((state: RootState) => state.product);
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        // Fetch initial stock from server
        const fetchInitialStock = async () => {
            try {
                const response = await axios.get(`/api/product/${PRODUCT_ID}/stock`);
                dispatch(setStock(response.data.stock));
            } catch (error) {
                console.error('Failed to fetch initial stock:', error);
                // If fetch fails, try to initialize stock via admin endpoint
                try {
                    await axios.post('/api/admin/inventory', {
                        productId: PRODUCT_ID,
                        count: 100,
                    });
                    dispatch(setStock(100));
                } catch (initError) {
                    console.error('Failed to initialize stock:', initError);
                }
            }
        };

        fetchInitialStock();

        // Set up WebSocket for real-time updates
        const socket = io('http://localhost:3000');

        socket.on('inventory_update', (data: { productId: string; stock: number }) => {
            if (data.productId === PRODUCT_ID) {
                dispatch(setStock(data.stock));
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [dispatch]);

    const handleBuy = async () => {
        if (stock > 0 && status !== 'loading') {
            try {
                await dispatch(purchaseItem(PRODUCT_ID)).unwrap();
            } catch (error: any) {
                console.error('Purchase failed:', error);
                // Error is already handled by Redux, but we can show additional feedback
            }
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

                {error && (
                    <div className="error-message" style={{ 
                        background: '#fee2e2', 
                        color: '#dc2626', 
                        padding: '0.75rem', 
                        borderRadius: '4px', 
                        marginBottom: '1rem' 
                    }}>
                        {error}
                    </div>
                )}

                {status === 'succeeded' && (
                    <div style={{ 
                        background: '#d1fae5', 
                        color: '#065f46', 
                        padding: '0.75rem', 
                        borderRadius: '4px', 
                        marginBottom: '1rem' 
                    }}>
                        ✅ Purchase successful! Order processing...
                    </div>
                )}

                <button
                    onClick={handleBuy}
                    disabled={stock === 0 || status === 'loading'}
                    className={stock === 0 ? 'disabled' : ''}
                >
                    {stock === 0 ? 'SOLD OUT' : status === 'loading' ? 'Processing...' : 'BUY NOW'}
                </button>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <Link to="/admin" style={{ color: '#666' }}>Go to Admin Dashboard</Link>
                <span style={{ color: '#999' }}>|</span>
                <button
                    onClick={async () => {
                        try {
                            await axios.post('/api/admin/inventory', {
                                productId: PRODUCT_ID,
                                count: 100,
                            });
                            alert('Stock initialized to 100!');
                            window.location.reload();
                        } catch (error) {
                            alert('Failed to initialize stock. Check server connection.');
                        }
                    }}
                    style={{
                        background: 'transparent',
                        border: '1px solid #666',
                        color: '#666',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                    }}
                >
                    Initialize Stock (100)
                </button>
            </div>
        </div>
    );
}
