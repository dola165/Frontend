export const useAuth = () => {
    const guest = localStorage.getItem('world-fixture-login') === 'guest';
    return {status:guest?'anonymous':'authenticated',sessionId:guest?null:'world-synthetic',user:guest?null:{id:4,dob:'1988-01-01',username:'fixture-adult',fullName:'Synthetic adult',roles:[],navigationCapabilities:{version:1,workspaces:[]},emailVerified:true},logout:()=>{},refreshUser:async()=>{},loading:false};
};
