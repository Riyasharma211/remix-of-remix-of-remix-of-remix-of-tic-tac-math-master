import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { X, Users, UserPlus, UserMinus, Circle, Send, Check, X as XIcon } from 'lucide-react';
import { useFriends, Friend } from '@/hooks/useFriends';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { haptics } from '@/utils/haptics';
import { soundManager } from '@/utils/soundManager';
import { toast } from '@/hooks/use-toast';

interface FriendsListProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteFriend?: (friendId: string) => void;
}

const FriendsList: React.FC<FriendsListProps> = ({ isOpen, onClose, onInviteFriend }) => {
  const {
    friends,
    friendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    getOnlineFriends,
  } = useFriends();
  const { profile } = useUserProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');

  const onlineFriends = getOnlineFriends();
  const filteredFriends = friends.filter(f =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.displayName && f.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddFriend = () => {
    if (!addFriendInput.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a username',
      });
      return;
    }

    sendFriendRequest(addFriendInput.trim());
    setAddFriendInput('');
    haptics.success();
    soundManager.playLocalSound('correct');
    toast({
      title: 'Friend Request Sent',
      description: `Request sent to ${addFriendInput.trim()}`,
    });
  };

  const handleRemoveFriend = (friendId: string) => {
    removeFriend(friendId);
    haptics.light();
    soundManager.playLocalSound('click');
    toast({
      title: 'Friend Removed',
      description: 'Friend has been removed from your list',
    });
  };

  const handleInviteFriend = (friendId: string) => {
    if (onInviteFriend) {
      onInviteFriend(friendId);
    }
    haptics.light();
    soundManager.playLocalSound('click');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-neon-cyan" />
            Friends
          </DialogTitle>
          <DialogDescription>
            Connect with friends and play together
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-border">
            <button
              onClick={() => {
                setActiveTab('friends');
                haptics.light();
              }}
              className={`px-4 py-2 text-sm font-orbitron transition-all border-b-2 ${
                activeTab === 'friends'
                  ? 'border-neon-cyan text-neon-cyan'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Friends ({friends.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('requests');
                haptics.light();
              }}
              className={`px-4 py-2 text-sm font-orbitron transition-all border-b-2 relative ${
                activeTab === 'requests'
                  ? 'border-neon-purple text-neon-purple'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Requests
              {friendRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-neon-pink text-white text-xs flex items-center justify-center">
                  {friendRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('add');
                haptics.light();
              }}
              className={`px-4 py-2 text-sm font-orbitron transition-all border-b-2 ${
                activeTab === 'add'
                  ? 'border-neon-green text-neon-green'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Add
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Friends Tab */}
            {activeTab === 'friends' && (
              <>
                {friends.length > 0 && (
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search friends..."
                    className="font-rajdhani"
                  />
                )}
                {filteredFriends.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-rajdhani">No friends yet</p>
                    <p className="text-sm text-muted-foreground/60 font-rajdhani mt-1">
                      Add friends to play together!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {onlineFriends.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-xs font-orbitron text-neon-green uppercase mb-2">
                          Online ({onlineFriends.length})
                        </h3>
                        <div className="space-y-2">
                          {onlineFriends
                            .filter(f =>
                              f.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (f.displayName && f.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
                            )
                            .map(friend => (
                              <FriendCard
                                key={friend.id}
                                friend={friend}
                                onRemove={() => handleRemoveFriend(friend.id)}
                                onInvite={() => handleInviteFriend(friend.id)}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                    {filteredFriends.filter(f => !f.isOnline).length > 0 && (
                      <div>
                        <h3 className="text-xs font-orbitron text-muted-foreground uppercase mb-2">
                          Offline ({filteredFriends.filter(f => !f.isOnline).length})
                        </h3>
                        <div className="space-y-2">
                          {filteredFriends
                            .filter(f => !f.isOnline)
                            .map(friend => (
                              <FriendCard
                                key={friend.id}
                                friend={friend}
                                onRemove={() => handleRemoveFriend(friend.id)}
                                onInvite={() => handleInviteFriend(friend.id)}
                              />
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <>
                {friendRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <UserPlus className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-rajdhani">No pending requests</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friendRequests.map(request => (
                      <div
                        key={request.id}
                        className="p-3 bg-card/50 border border-border rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl">
                            👤
                          </div>
                          <div>
                            <p className="font-rajdhani text-sm font-semibold">{request.username}</p>
                            <p className="text-xs text-muted-foreground font-rajdhani">
                              {new Date(request.sentAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              // In a real app, you'd fetch friend data from server
                              const mockFriend: Friend = {
                                id: `friend_${Date.now()}`,
                                username: request.username,
                                displayName: request.username,
                                avatar: '😀',
                                isOnline: false,
                                lastSeen: Date.now(),
                                level: 1,
                                totalWins: 0,
                                totalGames: 0,
                              };
                              acceptFriendRequest(request.id, mockFriend);
                              haptics.success();
                              soundManager.playLocalSound('correct');
                            }}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              rejectFriendRequest(request.id);
                              haptics.light();
                            }}
                          >
                            <XIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Add Friend Tab */}
            {activeTab === 'add' && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Add Friend by Username
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={addFriendInput}
                      onChange={(e) => setAddFriendInput(e.target.value)}
                      placeholder="Enter username..."
                      className="font-rajdhani"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddFriend();
                        }
                      }}
                    />
                    <Button
                      onClick={handleAddFriend}
                      disabled={!addFriendInput.trim()}
                      className="bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green/30"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <p className="text-xs text-muted-foreground font-rajdhani text-center">
                    Share your username: <span className="font-orbitron text-neon-cyan">{profile.username}</span>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      navigator.clipboard.writeText(profile.username);
                      haptics.light();
                      soundManager.playLocalSound('click');
                      toast({
                        title: 'Copied!',
                        description: 'Username copied to clipboard',
                      });
                    }}
                  >
                    Copy My Username
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const FriendCard: React.FC<{
  friend: Friend;
  onRemove: () => void;
  onInvite: () => void;
}> = ({ friend, onRemove, onInvite }) => {
  return (
    <div className="p-3 bg-card/50 border border-border rounded-xl flex items-center justify-between hover:border-neon-cyan/50 transition-all">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative">
          <div className="text-3xl">{friend.avatar}</div>
          {friend.isOnline && (
            <Circle className="w-3 h-3 text-neon-green absolute -bottom-0 -right-0 fill-neon-green" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-rajdhani text-sm font-semibold text-foreground truncate">
            {friend.displayName || friend.username}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-rajdhani">
            <span>Level {friend.level}</span>
            <span>•</span>
            <span>{friend.totalWins} wins</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onInvite}
          title="Invite to game"
        >
          <UserPlus className="w-4 h-4 text-neon-green" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onRemove}
          title="Remove friend"
        >
          <UserMinus className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

export default FriendsList;
