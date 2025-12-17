-- Create chat_messages table for Truth & Dare game
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('system', 'player1', 'player2')),
  sender_name TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'buttons', 'input', 'result')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  disabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies - anyone can read/write chat messages (public game)
CREATE POLICY "Anyone can read chat messages"
ON public.chat_messages
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert chat messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update chat messages"
ON public.chat_messages
FOR UPDATE
USING (true);

-- Create index for faster queries
CREATE INDEX idx_chat_messages_room_id ON public.chat_messages(room_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Enable realtime for chat_messages
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;