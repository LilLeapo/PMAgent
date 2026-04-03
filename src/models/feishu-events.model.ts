export interface MessageEvent {
  sender: {
    sender_id: {
      open_id: string;
      user_id?: string;
      union_id?: string;
    };
    sender_type: string;
  };
  message: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    chat_id: string;
    chat_type: string;
    message_type: string;
    content: string;
    mentions?: Array<{
      key: string;
      id: {
        open_id: string;
        user_id?: string;
        union_id?: string;
      };
      name: string;
    }>;
  };
}

export interface TextContent {
  text: string;
}

export interface CardAction {
  open_id: string;
  action: {
    value: Record<string, string>;
    tag: string;
  };
  open_message_id: string;
  open_chat_id: string;
}
