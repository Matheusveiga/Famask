import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
}

interface AuthContextData {
    user: User | null;
    loadUser: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem('@Famask:user');
        return storedUser ? JSON.parse(storedUser) : null;
    });



    const loadUser = () => {
        const storedUser = localStorage.getItem('@Famask:user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    };

    const logout = async () => {
        try {
            await api.post('/api/auth/logout');
        } catch (e) {
            console.error(e);
        }
        localStorage.removeItem('@Famask:user');
        setUser(null);
    };

    useEffect(() => {
        loadUser();
    }, []);

    return (
        <AuthContext.Provider value={{ user, loadUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
