import axios from 'axios';

// Create the base client
export const apiClient = axios.create({
    baseURL: 'http://localhost:8080', // Replace with your actual backend URL
    withCredentials: true, // Important if your refresh token is in an HttpOnly cookie
});

// 1. Request Interceptor: Attach the current token to every request
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

// 2. Response Interceptor: The "Silent Refresh" Engine
apiClient.interceptors.response.use(
    (response) => {
        // If the request succeeds, just pass it through
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // If the error is 401 (Unauthorized) and we haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; // Mark this request so we don't get stuck in an infinite loop

            try {
                // IMPORTANT: Call your Spring Boot refresh endpoint here.
                // Assuming your refresh token is in an HttpOnly cookie, so `withCredentials: true` sends it automatically.
                // (Adjust the URL to match your backend's refresh endpoint)
                const refreshResponse = await axios.post('http://localhost:8080/api/auth/refresh', {}, {
                    withCredentials: true
                });

                // Get the new shiny access token from the response
                const newAccessToken = refreshResponse.data.accessToken;

                // Save it to localStorage
                localStorage.setItem('accessToken', newAccessToken);

                // Update the failed request with the new token
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                // Retry the original request (e.g., the /users/me call or Map data call)
                return apiClient(originalRequest);

            } catch (refreshError) {
                // If the REFRESH token is also expired, THEN we finally log them out.
                localStorage.removeItem('accessToken');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        // For all other errors, just return the error normally
        return Promise.reject(error);
    }
);