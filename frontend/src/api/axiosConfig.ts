import axios from 'axios';

export const apiClient = axios.create({
    baseURL: 'http://localhost:8080/api', // Your Spring Boot URL
    withCredentials: true, // THIS IS MANDATORY for our cookie auth to work!
    headers: {
        'Content-Type': 'application/json',
    },
});