package chatapp.realtimeservice.security;

import java.security.Principal;

public class UserPrincipal implements Principal {
    private final String userId;

    public UserPrincipal(String userId) {
        this.userId = userId;
    }

    @Override
    public String getName() {
        return userId;
    }
}
